import type { Context } from "../../../context-engine";
import type { PipelineContext } from "../../pipeline-context";
import type { Insight } from "../../entities/insight";

/**
 * Resuelve el `Context` que Context Engine ya filtró, puntuó y
 * priorizó (Filter→Score→Prioritize, `core/context-engine`) de vuelta
 * a `Insight`s reales -- nunca vuelve a decidir qué es relevante, esa
 * decisión ya la tomó Context Engine. Reasoning solo pregunta "de lo
 * que ya se decidió que importa ahora mismo, ¿cuáles son insights
 * validados sobre los que se puede razonar?".
 */
export interface ReasoningGatherStage {
  gather(context: Context, pipelineContext: PipelineContext): Promise<Insight[]>;
}
