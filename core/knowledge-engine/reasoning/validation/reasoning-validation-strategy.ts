import type { EntityId } from "../../../life/value-objects/entity-id";
import type { PipelineContext } from "../../pipeline-context";
import type { Confidence } from "../../value-objects/confidence";
import type { EvidenceCluster } from "../correlation/reasoning-correlate-stage";
import type { ProposedReasoning } from "../inference/reasoning-strategy";

/** Lista para persistir -- ya decidida, nunca se construye a mano fuera de una `ReasoningValidationStrategy`. */
export interface ValidatedReasoning {
  statement: string;
  confidence: Confidence;
  uncertaintyNotes: string[];
  supportingInsightIds: EntityId[];
  contradictingInsightIds: EntityId[];
}

/**
 * LUZ decide (Principio 8) -- `null` cuando la propuesta no alcanza el
 * umbral de evidencia/confianza; nunca lanza, nunca persiste nada por
 * su cuenta (eso es `ReasoningPersistStage`).
 */
export interface ReasoningValidationStrategy {
  validate(
    cluster: EvidenceCluster,
    proposed: ProposedReasoning | null,
    pipelineContext: PipelineContext,
  ): Promise<ValidatedReasoning | null>;
}
