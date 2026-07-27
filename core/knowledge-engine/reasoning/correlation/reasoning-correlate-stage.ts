import type { PipelineContext } from "../../pipeline-context";
import type { Insight } from "../../entities/insight";

/** Dos o más insights ya validados, conectados entre sí -- la unidad mínima sobre la que vale la pena razonar (un insight suelto no basta, ver `deterministic-reasoning-validation-strategy.ts`). */
export interface EvidenceCluster {
  insights: Insight[];
}

/**
 * Agrupa el conjunto que `ReasoningGatherStage` ya reunió en clusters
 * de insights conectados entre sí -- nunca vuelve a DETECTAR
 * relaciones (eso ya lo hizo `DefaultInsightConnectStage` al persistir
 * cada insight), solo las recorre para encontrar componentes conexos.
 */
export interface ReasoningCorrelateStage {
  correlate(
    insights: Insight[],
    pipelineContext: PipelineContext,
  ): Promise<EvidenceCluster[]>;
}
