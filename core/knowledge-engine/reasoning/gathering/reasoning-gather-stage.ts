import type { PipelineContext } from "../../pipeline-context";
import type { Insight } from "../../entities/insight";
import type { ReasoningEvidenceWindow } from "./reasoning-evidence-window";

/**
 * Resuelve una `ReasoningEvidenceWindow` ya armada (hoy, por Context
 * Engine -- ver docblock de `ReasoningEvidenceWindow`) de vuelta a
 * `Insight`s reales, validados -- nunca vuelve a decidir qué es
 * relevante, esa decisión ya la tomó quien armó la ventana. Reasoning
 * solo pregunta "de este conjunto candidato, ¿cuáles son insights
 * validados sobre los que se puede razonar?".
 */
export interface ReasoningGatherStage {
  gather(
    window: ReasoningEvidenceWindow,
    pipelineContext: PipelineContext,
  ): Promise<Insight[]>;
}
