import type { EntityId } from "../../../life/value-objects/entity-id";
import type { PipelineContext } from "../../pipeline-context";
import type { ReasoningConclusion } from "../entities/reasoning-conclusion";
import type { ValidatedReasoning } from "../validation/reasoning-validation-strategy";

/**
 * Orquesta, nunca decide -- depende de `ReasoningRepository`, mismo
 * patrón que `DefaultPersistStage` (Knowledge Engine base). Solo
 * persiste conclusiones ya validadas: una `ValidatedReasoning`
 * rechazada por `ReasoningValidationStrategy` (devuelta como `null`)
 * nunca llega hasta aquí -- el orquestador (`DefaultReasoningEngine`)
 * la descarta antes.
 */
export interface ReasoningPersistStage {
  persist(
    validated: ValidatedReasoning,
    /** Memorias de evidencia de cada insight de apoyo -- ya resueltas por el orquestador (`InsightRepository.getEvidence`), nunca vuelto a consultar aquí. */
    evidenceMemoryIdsByInsightId: Map<EntityId, EntityId[]>,
    pipelineContext: PipelineContext,
  ): Promise<ReasoningConclusion>;
}
