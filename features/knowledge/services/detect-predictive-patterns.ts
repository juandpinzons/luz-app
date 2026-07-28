import { DrizzleBeliefRepository } from "../../../core/belief-engine";
import type { Database } from "../../../core/db/client";
import { DrizzleImportanceRepository, updateImportance } from "../../../core/importance-engine";
import { DrizzleInsightRepository } from "../../../core/knowledge-engine";
import type { InsightRepository } from "../../../core/knowledge-engine/repositories/insight.repository";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import { createEntityId } from "../../../core/life/value-objects/entity-id";
import { LIFE_DOMAIN_LABEL } from "../../../core/life/value-objects/life-domain-label";
import {
  computePatternConfidence,
  describePattern,
  detectDomainCoMovement,
} from "../../../core/predictive-engine";
import { collectDomainMovements } from "./collect-domain-movements";

/**
 * No vuelve a crear el mismo patrón cada vez que corre -- un patrón ya
 * conocido sigue siendo cierto, pero repetirlo como Insight nuevo en
 * cada job sería ruido, no comprensión nueva. Se considera "ya
 * conocido" si un Insight `pattern` ya validado, creado dentro de esta
 * ventana, menciona los dos dominios del candidato -- heurística
 * simple sobre texto ya generado por esta misma plantilla
 * (`describe-pattern.ts`), no una segunda tabla de deduplicación.
 */
const DEDUPE_WINDOW_DAYS = 21;
const DEDUPE_WINDOW_MS = DEDUPE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

async function alreadyKnown(
  insightRepository: InsightRepository,
  context: LifeGraphContext,
  fromLabel: string,
  toLabel: string,
  now: Date,
): Promise<boolean> {
  const insights = await insightRepository.list(context);
  return insights.some(
    (insight) =>
      insight.type === "pattern" &&
      insight.status === "validated" &&
      now.getTime() - insight.createdAt.getTime() <= DEDUPE_WINDOW_MS &&
      insight.description.includes(fromLabel) &&
      insight.description.includes(toLabel),
  );
}

/**
 * Predictive Intelligence (Knowledge Engine V2) -- corre al final de
 * `enrichKnowledgeGraph`, después de que Belief Engine ya actualizó
 * `belief_history` para este job. Determinista de principio a fin
 * (`detectDomainCoMovement`/`describePattern`): el hallazgo es un
 * conteo verificable, no una interpretación que necesite IA. Persiste
 * como `Insight` tipo "pattern" -- reutiliza el pipeline existente
 * (chat, Morning Brief) en vez de crear una superficie nueva para
 * mostrarlo (instrucción explícita: "no crear motores duplicados").
 */
export async function detectPredictivePatterns(
  db: Database,
  context: LifeGraphContext,
): Promise<void> {
  const beliefRepository = new DrizzleBeliefRepository(db);
  const insightRepository = new DrizzleInsightRepository(db);
  const importanceRepository = new DrizzleImportanceRepository(db);

  const movements = await collectDomainMovements(beliefRepository, context);
  const candidates = detectDomainCoMovement(movements);
  if (candidates.length === 0) {
    return;
  }

  const now = new Date();

  for (const candidate of candidates) {
    const fromLabel = LIFE_DOMAIN_LABEL[candidate.fromDomain];
    const toLabel = LIFE_DOMAIN_LABEL[candidate.toDomain];

    if (await alreadyKnown(insightRepository, context, fromLabel, toLabel, now)) {
      continue;
    }

    const [fromEvidence, toEvidence] = await Promise.all([
      beliefRepository.getEvidence(context, candidate.sampleFromBeliefId),
      beliefRepository.getEvidence(context, candidate.sampleToBeliefId),
    ]);

    const fromMemoryId = fromEvidence.find((item) => item.memoryId)?.memoryId;
    const toMemoryId = toEvidence.find((item) => item.memoryId)?.memoryId;

    // Mismo umbral de evidencia mínima que `DeterministicInsightValidationStrategy`
    // (2 memorias distintas) -- sin evidencia real de cada lado, este
    // patrón no se persiste como Insight, sin importar cuántas veces
    // se haya contado (Principio 3: nunca sin evidencia citable).
    if (!fromMemoryId || !toMemoryId || fromMemoryId === toMemoryId) {
      continue;
    }

    const insight = await insightRepository.save(context, {
      id: createEntityId(crypto.randomUUID()),
      lifeGraphId: context.lifeGraphId,
      type: "pattern",
      description: describePattern(candidate),
      confidence: { score: computePatternConfidence(candidate.occurrences), assignedAt: now },
      status: "validated",
      createdAt: now,
      updatedAt: now,
      validatedAt: now,
    });

    await insightRepository.saveEvidence(context, {
      id: createEntityId(crypto.randomUUID()),
      lifeGraphId: context.lifeGraphId,
      insightId: insight.id,
      memoryId: fromMemoryId,
      createdAt: now,
    });
    await insightRepository.saveEvidence(context, {
      id: createEntityId(crypto.randomUUID()),
      lifeGraphId: context.lifeGraphId,
      insightId: insight.id,
      memoryId: toMemoryId,
      createdAt: now,
    });

    await updateImportance(importanceRepository, context, "insight", insight.id, {
      evidenceCount: 2,
      confidence: insight.confidence.score,
      recencyDays: 0,
    });
  }
}
