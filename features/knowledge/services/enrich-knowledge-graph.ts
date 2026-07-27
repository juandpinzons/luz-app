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
import { DrizzleImportanceRepository, updateImportance } from "../../../core/importance-engine";
import { DrizzleInsightRepository } from "../../../core/knowledge-engine";
import type { Insight } from "../../../core/knowledge-engine/entities/insight";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import type { EntityId } from "../../../core/life/value-objects/entity-id";
import { logger } from "../../../core/observability/logger";
import type { RealitySnapshot } from "../../../core/reality/reality-snapshot";
import { detectPredictivePatterns } from "./detect-predictive-patterns";

/** Cuántos otros Beliefs/items de vida se comparan como candidatos de contradicción -- acotado por costo/latencia (ver `AIContradictionDetectionStrategy`, una sola llamada por sujeto). */
const MAX_CONTRADICTION_CANDIDATES = 10;

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
 * Best-effort de principio a fin: cualquier error se loguea y se
 * traga, nunca se propaga -- una falla aquí no debe convertir un
 * insight ya persistido correctamente en un job fallido (Principio de
 * estabilidad del War Room: cero crashes). "Knowledge Engine V2" es
 * una capacidad que evoluciona sobre datos ya sólidos, no una que
 * pueda arriesgarlos.
 */
export async function enrichKnowledgeGraph(
  db: Database,
  snapshot: RealitySnapshot,
  context: LifeGraphContext,
  memoryId: EntityId,
): Promise<void> {
  try {
    const insightRepository = new DrizzleInsightRepository(db);
    const conceptRepository = new DrizzleConceptRepository(db);
    const beliefRepository = new DrizzleBeliefRepository(db);
    const contradictionRepository = new DrizzleContradictionRepository(db);
    const importanceRepository = new DrizzleImportanceRepository(db);

    const conceptStrategy = new AIConceptExtractionStrategy();
    const beliefStrategy = new AIBeliefConsolidationStrategy();
    const contradictionStrategy = new AIContradictionDetectionStrategy();

    const memoryById = new Map(snapshot.memory.items.map((item) => [item.id, item]));
    const triggeredInsights = await insightRepository.listByEvidenceMemoryId(
      context,
      memoryId,
    );

    for (const insight of triggeredInsights) {
      await enrichOneInsight(insight);
    }

    await decayStaleBeliefs(beliefRepository, context);
    await detectPredictivePatterns(db, context);

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
  } catch (error) {
    logger.log({
      event: "knowledge_graph.enrichment_failed",
      severity: "warn",
      lifeGraphId: context.lifeGraphId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
