import type { PipelineContext } from "../../pipeline-context";
import type { Insight } from "../../entities/insight";
import type { InsightRepository } from "../../repositories/insight.repository";
import type { ReasoningEvidenceWindow } from "./reasoning-evidence-window";
import type { ReasoningGatherStage } from "./reasoning-gather-stage";

/**
 * Determinista, sin IA -- depende únicamente de `InsightRepository`,
 * igual que `DefaultPersistStage`. Conserva el orden de
 * `window.insightIds`: quien arma la ventana ya decidió esa
 * prioridad (hoy, `relevanceScore` descendente de Context Engine), no
 * se vuelve a ordenar aquí.
 */
export class DefaultReasoningGatherStage implements ReasoningGatherStage {
  constructor(private readonly repository: InsightRepository) {}

  async gather(
    window: ReasoningEvidenceWindow,
    pipelineContext: PipelineContext,
  ): Promise<Insight[]> {
    const insights: Insight[] = [];

    for (const id of window.insightIds) {
      const insight = await this.repository.getById(pipelineContext, id);
      // Quien armó la ventana pudo haber leído un insight que, entre
      // ese momento y este, se borró o se invalidó -- nunca se asume
      // que sigue siendo válido solo porque llegó en la ventana.
      if (insight && insight.status === "validated") {
        insights.push(insight);
      }
    }

    return insights;
  }
}
