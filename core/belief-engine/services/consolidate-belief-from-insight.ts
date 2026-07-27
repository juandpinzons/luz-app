import { titlesLikelyMatch } from "../../life/services/title-similarity";
import type { LifeGraphContext } from "../../life/life-graph-context";
import { createEntityId, type EntityId } from "../../life/value-objects/entity-id";
import type { Insight } from "../../knowledge-engine/entities/insight";
import type { InsightType } from "../../knowledge-engine/value-objects/insight-type";
import type { BeliefConsolidationStrategy } from "../consolidation/belief-consolidation-strategy";
import type { Belief } from "../entities/belief";
import type { BeliefRepository } from "../repositories/belief.repository";

/**
 * Solo estos tipos de Insight pueden ser evidencia de un rasgo duradero
 * -- "risk"/"recommendation" son situacionales por definición
 * (`InsightType`, `core/knowledge-engine`), no algo que describa quién
 * es la persona. Gatear aquí, antes de llamar a la IA, evita gastar una
 * llamada en algo que nunca calificaría.
 */
const ELIGIBLE_INSIGHT_TYPES: readonly InsightType[] = ["preference", "fact", "pattern"];

/** Mismo criterio que `CONCEPT_CONFIDENCE_THRESHOLD`: una síntesis sobre un Insight ya validado exige más que el mínimo de validación. */
const BELIEF_CONFIDENCE_THRESHOLD = 55;

/** Cuánto sube la confianza de un Belief ya existente cuando un nuevo Insight lo refuerza. */
const REINFORCEMENT_BONUS = 8;

export interface ConsolidationResult {
  belief: Belief;
  action: "created" | "reinforced";
}

async function findMatchingBelief(
  repository: BeliefRepository,
  context: LifeGraphContext,
  statement: string,
  domain: Belief["domain"],
): Promise<Belief | null> {
  const existing = await repository.list(context);
  return (
    existing.find(
      (belief) =>
        belief.status !== "retracted" &&
        (belief.domain === domain || domain === undefined) &&
        titlesLikelyMatch(belief.statement, statement),
    ) ?? null
  );
}

/**
 * Corre después de que un Insight quedó persistido (ver
 * `enrich-knowledge-graph.ts`) -- best-effort, nunca lanza hacia
 * arriba salvo error real de persistencia: si la IA no encuentra nada
 * o la confianza no alcanza el umbral, devuelve `null` en silencio.
 */
export async function consolidateBeliefFromInsight(
  repository: BeliefRepository,
  strategy: BeliefConsolidationStrategy,
  context: LifeGraphContext,
  insight: Insight,
  evidenceMemories: { id: EntityId; content: string }[],
): Promise<ConsolidationResult | null> {
  if (
    !ELIGIBLE_INSIGHT_TYPES.includes(insight.type) ||
    evidenceMemories.length === 0
  ) {
    return null;
  }

  const proposed = await strategy.proposeStatement(
    insight,
    evidenceMemories.map((memory) => memory.content),
  );

  if (!proposed || proposed.confidence < BELIEF_CONFIDENCE_THRESHOLD) {
    return null;
  }

  const now = new Date();

  const match = await findMatchingBelief(
    repository,
    context,
    proposed.statement,
    proposed.domain,
  );

  if (match) {
    const newConfidence = Math.min(
      100,
      Math.round((match.confidence.score + proposed.confidence) / 2) +
        REINFORCEMENT_BONUS,
    );

    const reinforced: Belief = {
      ...match,
      status: "active",
      confidence: { score: newConfidence, assignedAt: now },
      lastReinforcedAt: now,
      updatedAt: now,
    };

    const saved = await repository.save(context, reinforced);

    await repository.appendHistory(context, {
      id: createEntityId(crypto.randomUUID()),
      lifeGraphId: context.lifeGraphId,
      beliefId: saved.id,
      previousConfidence: match.confidence.score,
      newConfidence,
      changeReason: `Reforzado por un nuevo insight (${insight.type}): "${insight.description}"`,
      changedAt: now,
    });

    for (const memory of evidenceMemories) {
      await repository.saveEvidence(context, {
        id: createEntityId(crypto.randomUUID()),
        lifeGraphId: context.lifeGraphId,
        beliefId: saved.id,
        insightId: insight.id,
        memoryId: memory.id,
        createdAt: now,
      });
    }

    return { belief: saved, action: "reinforced" };
  }

  const created: Belief = {
    id: createEntityId(crypto.randomUUID()),
    lifeGraphId: context.lifeGraphId,
    subjectPersonId: context.personId,
    statement: proposed.statement,
    domain: proposed.domain,
    status: "active",
    confidence: { score: proposed.confidence, assignedAt: now },
    firstObservedAt: now,
    lastReinforcedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const saved = await repository.save(context, created);

  await repository.appendHistory(context, {
    id: createEntityId(crypto.randomUUID()),
    lifeGraphId: context.lifeGraphId,
    beliefId: saved.id,
    newConfidence: proposed.confidence,
    changeReason: `Creado a partir de un insight (${insight.type}): "${insight.description}"`,
    changedAt: now,
  });

  for (const memory of evidenceMemories) {
    await repository.saveEvidence(context, {
      id: createEntityId(crypto.randomUUID()),
      lifeGraphId: context.lifeGraphId,
      beliefId: saved.id,
      insightId: insight.id,
      memoryId: memory.id,
      createdAt: now,
    });
  }

  return { belief: saved, action: "created" };
}
