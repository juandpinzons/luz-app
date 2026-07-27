import type { Context } from "../../../context-engine";
import type { EntityId } from "../../../life/value-objects/entity-id";
import type { PipelineContext } from "../../pipeline-context";
import type { Insight } from "../../entities/insight";
import type { InsightRepository } from "../../repositories/insight.repository";
import type { ReasoningGatherStage } from "./reasoning-gather-stage";

/**
 * Determinista, sin IA -- depende únicamente de `InsightRepository`,
 * igual que `DefaultPersistStage`. Conserva el orden que Context Engine
 * ya decidió (`relevanceScore` descendente): el primer insight de la
 * lista es el más relevante ahora mismo, no un orden nuevo inventado
 * aquí.
 */
export class DefaultReasoningGatherStage implements ReasoningGatherStage {
  constructor(private readonly repository: InsightRepository) {}

  async gather(context: Context, pipelineContext: PipelineContext): Promise<Insight[]> {
    const insightIds: EntityId[] = [];
    const seen = new Set<EntityId>();

    for (const item of context.items) {
      if (item.source !== "insight" || !item.sourceId) {
        continue;
      }
      if (seen.has(item.sourceId)) {
        continue;
      }
      seen.add(item.sourceId);
      insightIds.push(item.sourceId);
    }

    const insights: Insight[] = [];
    for (const id of insightIds) {
      const insight = await this.repository.getById(pipelineContext, id);
      // Context Engine solo debería haber recibido insights ya
      // validados (`assembleRealitySnapshot` filtra por `status ===
      // "validated"`), pero esta etapa no asume eso sin comprobarlo --
      // un insight borrado o invalidado entre que Context Engine corrió
      // y que Reasoning corre no debe colarse en la evidencia.
      if (insight && insight.status === "validated") {
        insights.push(insight);
      }
    }

    return insights;
  }
}
