import type { PipelineContext } from "../../pipeline-context";
import type { Insight } from "../../entities/insight";
import type { EntityId } from "../../../life/value-objects/entity-id";
import type { InsightRepository } from "../../repositories/insight.repository";
import type { EvidenceCluster, ReasoningCorrelateStage } from "./reasoning-correlate-stage";

/**
 * Determinista, sin IA -- componentes conexos sobre el grafo de
 * `InsightRelationship` ya persistido (`knowledge_engine_insight_relationships`),
 * restringido al conjunto que `ReasoningGatherStage` reunió. Nunca
 * expande hacia insights fuera de ese conjunto: Reasoning no vuelve a
 * decidir qué es relevante ahora mismo, esa decisión ya la tomó
 * Context Engine (mismo límite documentado en `ReasoningGatherStage`).
 * Insights sin ninguna relación dentro del conjunto forman su propio
 * cluster de tamaño 1 -- se dejan pasar tal cual, es la etapa Validate
 * quien decide que un cluster de 1 no alcanza (evidencia insuficiente,
 * nunca se descarta en silencio aquí).
 */
export class DefaultReasoningCorrelateStage implements ReasoningCorrelateStage {
  constructor(private readonly repository: InsightRepository) {}

  async correlate(
    insights: Insight[],
    pipelineContext: PipelineContext,
  ): Promise<EvidenceCluster[]> {
    if (insights.length === 0) {
      return [];
    }

    const nodeById = new Map(insights.map((insight) => [insight.id, insight]));
    const adjacency = new Map<EntityId, Set<EntityId>>();
    for (const id of nodeById.keys()) {
      adjacency.set(id, new Set());
    }

    for (const insight of insights) {
      const relationships = await this.repository.getRelationships(
        pipelineContext,
        insight.id,
      );

      for (const relationship of relationships) {
        const otherId =
          relationship.fromInsightId === insight.id
            ? relationship.toInsightId
            : relationship.fromInsightId;

        if (!nodeById.has(otherId)) {
          continue;
        }

        adjacency.get(insight.id)?.add(otherId);
        adjacency.get(otherId)?.add(insight.id);
      }
    }

    const visited = new Set<EntityId>();
    const clusters: EvidenceCluster[] = [];

    for (const id of nodeById.keys()) {
      if (visited.has(id)) {
        continue;
      }

      const componentIds: EntityId[] = [];
      const queue: EntityId[] = [id];
      visited.add(id);

      while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined) continue;
        componentIds.push(current);

        for (const neighbor of adjacency.get(current) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      const clusterInsights = componentIds
        .map((componentId) => nodeById.get(componentId))
        .filter((insight): insight is Insight => insight !== undefined);

      clusters.push({ insights: clusterInsights });
    }

    return clusters;
  }
}
