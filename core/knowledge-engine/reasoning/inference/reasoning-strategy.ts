import type { EntityId } from "../../../life/value-objects/entity-id";
import type { EvidenceCluster } from "../correlation/reasoning-correlate-stage";

export interface ProposedReasoning {
  conclusion: string;
  /** 0-100, propuesta -- LUZ decide el umbral (`deterministic-reasoning-validation-strategy.ts`). */
  confidence: number;
  /** Subconjunto de `cluster.insights` -- cuáles complican o van en contra de la conclusión, nunca inventados fuera del cluster. */
  contradictingInsightIds: EntityId[];
  uncertaintyNotes: string[];
}

/**
 * Propone una conclusión a partir de un `EvidenceCluster` ya
 * correlacionado -- "el LLM propone, LUZ decide" (Principio 8), mismo
 * patrón que `InsightGenerationStrategy`/`BeliefConsolidationStrategy`/
 * `ConceptExtractionStrategy`. `evidenceByInsightId` llega ya resuelta
 * por el llamador (nunca importa `core/memory-engine` aquí, mismo
 * límite que ya documenta `Evidence.memoryId`).
 */
export interface ReasoningStrategy {
  propose(
    cluster: EvidenceCluster,
    evidenceByInsightId: Map<EntityId, string[]>,
  ): Promise<ProposedReasoning | null>;
}
