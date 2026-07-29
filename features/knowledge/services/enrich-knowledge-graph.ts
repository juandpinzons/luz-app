import type { Database } from "../../../core/db/client";
import {
  AIBeliefConsolidationStrategy,
  DrizzleBeliefRepository,
  consolidateBeliefFromInsight,
  decayStaleBeliefs,
} from "../../../core/belief-engine";
import {
  AIConceptExtractionStrategy,
  DrizzleConceptRepository,
  extractConceptsFromInsight,
} from "../../../core/concept-graph";
import {
  AIContradictionDetectionStrategy,
  DrizzleContradictionRepository,
  detectContradictions,
  type ContradictionCandidate,
} from "../../../core/contradiction-engine";
import { createContextEngine, type Context } from "../../../core/context-engine";
import {
  AICuriosityQuestionGenerationStrategy,
  DrizzleCuriosityQuestionRepository,
  generateCuriosityQuestion,
  resolveStaleCuriosityQuestions,
} from "../../../core/curiosity-engine";
import { DrizzleImportanceRepository, updateImportance } from "../../../core/importance-engine";
import {
  createReasoningEngine,
  DrizzleInsightRepository,
  DrizzleReasoningRepository,
  type ReasoningEvidenceWindow,
} from "../../../core/knowledge-engine";
import type { Insight } from "../../../core/knowledge-engine/entities/insight";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import type { EntityId } from "../../../core/life/value-objects/entity-id";
import { LIFE_DOMAIN_LABEL } from "../../../core/life/value-objects/life-domain-label";
import { describeError } from "../../../core/observability/describe-error";
import { logger } from "../../../core/observability/logger";
import { recordEvent } from "../../../core/observability/record-event";
import type { RealitySnapshot } from "../../../core/reality/reality-snapshot";
import { detectPredictivePatterns } from "./detect-predictive-patterns";

/** Cuántos otros Beliefs/items de vida se comparan como candidatos de contradicción -- acotado por costo/latencia (ver `AIContradictionDetectionStrategy`, una sola llamada por sujeto). */
const MAX_CONTRADICTION_CANDIDATES = 10;

/**
 * Único lugar que traduce "lo que Context Engine decidió relevante"
 * (`Context`) a la forma neutral que el Reasoning Engine sí conoce
 * (`ReasoningEvidenceWindow`, `core/knowledge-engine/reasoning`) --
 * exactamente el punto donde una ventana de razonamiento más amplia
 * (Top N por `core/importance-engine`, o un recorrido del grafo de
 * `core/concept-graph`/`core/belief-engine`) se conectaría a futuro:
 * otra función con esta misma forma de salida, nunca un cambio dentro
 * de `core/knowledge-engine/reasoning`.
 */
function toReasoningEvidenceWindow(context: Context): ReasoningEvidenceWindow {
  const insightIds: EntityId[] = [];
  const seen = new Set<EntityId>();

  for (const item of context.items) {
    if (item.source !== "insight" || !item.sourceId || seen.has(item.sourceId)) {
      continue;
    }
    seen.add(item.sourceId);
    insightIds.push(item.sourceId);
  }

  return { insightIds };
}

function daysSince(date: Date, now: Date): number {
  return Math.max(0, (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Corre DESPUÉS de que `KnowledgeEngine.run()` terminó (ver
 * `process-knowledge-job.ts`, el único llamador real) -- nunca antes,
 * nunca dentro del pipeline Extract→Persist (decisión CTO #5 no
 * cambia). Encuentra los insights que esta memoria concreta acaba de
 * validar y, para cada uno, extiende el grafo de conocimiento: Concept
 * Graph, Belief Engine, Contradiction Detection, Importance Engine.
 *
 * Best-effort POR ETAPA, no solo de principio a fin: cada insight y
 * cada capacidad de cierre (`decayStaleBeliefs`/`detectPredictivePatterns`/
 * `runReasoning`/`runCuriosity`) corre dentro de `runStage`, con su
 * propio try/catch -- nunca un único catch envolviendo las siete
 * (auditoría LEOS: antes, un fallo de IA en la primera etapa -- p.ej.
 * concept extraction del primer insight -- abortaba silenciosamente
 * decay/predictive/reasoning/curiosity para todo el turno, y el log
 * único no distinguía cuál etapa había fallado). Cada error se loguea
 * y se persiste (`recordEvent`, consultable desde /admin) con su
 * `stage`, y se traga, nunca se propaga -- una falla aquí no debe
 * convertir un insight ya persistido correctamente en un job fallido
 * (Principio de estabilidad del War Room: cero crashes), y ahora
 * tampoco debe arrastrar capacidades hermanas que no dependen de ella.
 * "Knowledge Engine V2" es una capacidad que evoluciona sobre datos ya
 * sólidos, no una que pueda arriesgarlos.
 */
export async function enrichKnowledgeGraph(
  db: Database,
  snapshot: RealitySnapshot,
  context: LifeGraphContext,
  memoryId: EntityId,
): Promise<void> {
  const insightRepository = new DrizzleInsightRepository(db);
  const conceptRepository = new DrizzleConceptRepository(db);
  const beliefRepository = new DrizzleBeliefRepository(db);
  const contradictionRepository = new DrizzleContradictionRepository(db);
  const importanceRepository = new DrizzleImportanceRepository(db);

  const conceptStrategy = new AIConceptExtractionStrategy();
  const beliefStrategy = new AIBeliefConsolidationStrategy();
  const contradictionStrategy = new AIContradictionDetectionStrategy();

  /**
   * Frontera de aislamiento por etapa (ver docblock de arriba): un
   * fallo dentro de `fn` nunca impide que corran las demás llamadas a
   * `runStage` en este job. `stage` viaja en el log y en
   * `events.metadata` para que /admin pueda distinguir "falló concept
   * extraction del insight X" de "falló curiosity" sin adivinar.
   */
  async function runStage(stage: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      const detail = describeError(error);
      logger.log({
        event: "knowledge_graph.enrichment_failed",
        severity: "warn",
        stage,
        lifeGraphId: context.lifeGraphId,
        memoryId,
        ...detail,
      });
      await recordEvent(db, {
        type: "error",
        route: "background.knowledge_graph_enrichment",
        message: error instanceof Error ? error.message : String(error),
        metadata: {
          stage,
          lifeGraphId: context.lifeGraphId,
          memoryId,
          errorName: detail.errorName,
          errorCode: detail.errorCode,
        },
      });
    }
  }

  try {
    const memoryById = new Map(snapshot.memory.items.map((item) => [item.id, item]));
    const triggeredInsights = await insightRepository.listByEvidenceMemoryId(
      context,
      memoryId,
    );

    for (const insight of triggeredInsights) {
      await runStage(`insight:${insight.id}`, () => enrichOneInsight(insight));
    }

    await runStage("decayStaleBeliefs", () => decayStaleBeliefs(beliefRepository, context));
    await runStage("detectPredictivePatterns", () => detectPredictivePatterns(db, context));
    await runStage("runReasoning", runReasoning);
    await runStage("runCuriosity", runCuriosity);

    async function enrichOneInsight(insight: Insight): Promise<void> {
      const evidence = await insightRepository.getEvidence(context, insight.id);
      const evidenceMemories = evidence
        .map((item) => memoryById.get(item.memoryId))
        .filter((item): item is NonNullable<typeof item> => item !== undefined);

      const touchedConcepts = await extractConceptsFromInsight(
        conceptRepository,
        conceptStrategy,
        context,
        insight,
        evidenceMemories,
      );

      for (const concept of touchedConcepts) {
        const conceptEvidence = await conceptRepository.listEvidence(context, concept.id);
        const conceptRelations = await conceptRepository.listRelations(context, concept.id);
        await updateImportance(importanceRepository, context, "concept", concept.id, {
          evidenceCount: conceptEvidence.length,
          connectionCount: conceptRelations.length,
          recencyDays: 0,
        });
      }

      await updateImportance(importanceRepository, context, "insight", insight.id, {
        evidenceCount: evidence.length,
        confidence: insight.confidence.score,
        recencyDays: 0,
      });

      const consolidation = await consolidateBeliefFromInsight(
        beliefRepository,
        beliefStrategy,
        context,
        insight,
        evidenceMemories,
      );

      if (!consolidation) {
        return;
      }

      const { belief } = consolidation;
      const beliefEvidence = await beliefRepository.getEvidence(context, belief.id);

      const otherBeliefs = (await beliefRepository.list(context)).filter(
        (candidate) => candidate.id !== belief.id && candidate.status === "active",
      );
      const beliefCandidates: ContradictionCandidate[] = otherBeliefs
        .slice(0, MAX_CONTRADICTION_CANDIDATES)
        .map((candidate) => ({
          refType: "belief",
          refId: candidate.id,
          text: candidate.statement,
        }));

      const lifeCandidates: ContradictionCandidate[] = [
        ...snapshot.life.activeGoals.map((item) => ({ refType: "goal", ...item })),
        ...snapshot.life.activeProjects.map((item) => ({ refType: "project", ...item })),
        ...snapshot.life.activeHabits.map((item) => ({ refType: "habit", ...item })),
      ]
        .slice(0, MAX_CONTRADICTION_CANDIDATES)
        .map((item) => ({ refType: item.refType, refId: item.id, text: item.title }));

      const candidates = [...beliefCandidates, ...lifeCandidates].slice(
        0,
        MAX_CONTRADICTION_CANDIDATES,
      );

      const contradictions = await detectContradictions(
        contradictionRepository,
        contradictionStrategy,
        context,
        { refType: "belief", refId: belief.id, text: belief.statement },
        candidates,
        belief.domain,
      );

      await updateImportance(importanceRepository, context, "belief", belief.id, {
        evidenceCount: beliefEvidence.length,
        confidence: belief.confidence.score,
        recencyDays: daysSince(belief.lastReinforcedAt, new Date()),
        involvedInOpenContradiction: contradictions.length > 0,
      });
    }

    /**
     * Reasoning Engine (`core/knowledge-engine/reasoning`) -- corre una
     * vez por job, no por insight: necesita la vista de Context Engine
     * sobre TODO lo relevante ahora mismo, no solo lo que esta memoria
     * disparó. Reutiliza `createContextEngine` (el mismo que ya usan
     * chat y Morning Brief) en vez de inventar una segunda forma de
     * decidir relevancia -- "consumir Context Engine", no duplicarlo.
     */
    async function runReasoning(): Promise<void> {
      const engineContext = await createContextEngine(db).build(snapshot, context);
      const window = toReasoningEvidenceWindow(engineContext);
      const memoryContentById = new Map(
        snapshot.memory.items.map((item) => [item.id, item.content]),
      );

      const conclusions = await createReasoningEngine(db).run(
        window,
        { ...context, memoryId },
        memoryContentById,
      );

      const reasoningRepository = new DrizzleReasoningRepository(db);
      for (const conclusion of conclusions) {
        const conclusionEvidence = await reasoningRepository.getEvidence(context, conclusion.id);
        await updateImportance(
          importanceRepository,
          context,
          "reasoning_conclusion",
          conclusion.id,
          {
            evidenceCount: conclusionEvidence.length,
            confidence: conclusion.confidence.score,
            recencyDays: 0,
            involvedInOpenContradiction: conclusionEvidence.some(
              (item) => item.ref.role === "contradicting",
            ),
          },
        );
      }
    }

    /**
     * Curiosity Engine (`core/curiosity-engine`) -- corre una vez por
     * job, igual que Reasoning: primero revisa si la pregunta
     * `pending` actual (si hay una) sigue siendo el vacío real más
     * urgente, después genera una nueva solo si no quedó ninguna
     * pendiente (a lo sumo una a la vez, ver docblock del schema).
     * `knownAboutPerson` usa lo mismo que ya se le muestra al chat
     * (insights/reasoning validados de este snapshot) -- nunca una
     * consulta nueva, ancla la pregunta a la persona real sin inventar
     * contexto.
     */
    async function runCuriosity(): Promise<void> {
      const curiosityRepository = new DrizzleCuriosityQuestionRepository(db);

      await resolveStaleCuriosityQuestions(
        curiosityRepository,
        context,
        snapshot.knowledgeGaps.domains,
      );

      const weakest = [...snapshot.knowledgeGaps.domains].sort(
        (a, b) => a.coverageScore - b.coverageScore,
      )[0];
      if (!weakest) {
        return;
      }

      const knownAboutPerson = [
        ...snapshot.insights.items.map((item) => item.description),
        ...snapshot.reasoning.items.map((item) => item.statement),
      ].slice(0, 5);

      await generateCuriosityQuestion(
        curiosityRepository,
        new AICuriosityQuestionGenerationStrategy(),
        context,
        {
          weakestDomain: {
            domain: weakest.domain,
            label: LIFE_DOMAIN_LABEL[weakest.domain],
            coverageScore: weakest.coverageScore,
          },
          knownAboutPerson,
        },
      );
    }
  } catch (error) {
    // Red de seguridad externa, no la ruta principal de errores (esa es
    // `runStage` arriba) -- solo atrapa lo que pasa ANTES de que haya
    // etapas que aislar: construir los repositorios/estrategias o
    // resolver `triggeredInsights` (`listByEvidenceMemoryId`). Mismo
    // criterio que `life-capture-service.ts` (auditoría 2026-07-25,
    // OBSERVABILITY_PLAN.md): detalle completo
    // (`errorStack`/`errorQuery`/`errorParameters`) solo a consola vía
    // `describeError`, nunca a `events.metadata`.
    const detail = describeError(error);
    logger.log({
      event: "knowledge_graph.enrichment_failed",
      severity: "warn",
      stage: "setup",
      lifeGraphId: context.lifeGraphId,
      memoryId,
      ...detail,
    });
    await recordEvent(db, {
      type: "error",
      route: "background.knowledge_graph_enrichment",
      message: error instanceof Error ? error.message : String(error),
      metadata: {
        stage: "setup",
        lifeGraphId: context.lifeGraphId,
        memoryId,
        errorName: detail.errorName,
        errorCode: detail.errorCode,
      },
    });
  }
}
