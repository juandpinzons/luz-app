import type { ValidatedInsight } from "../validation/insight-validation-strategy";
import type { PipelineContext } from "../pipeline-context";

/** Solo el contrato — persistir es responsabilidad de una implementación futura. */
export interface PersistStage {
  persist(
    insights: ValidatedInsight[],
    context: PipelineContext,
  ): Promise<void>;
}
