import type { FollowUpRecommendation, RecommendationPriority } from "../../dashboard/services/build-follow-up-recommendations";

const PRIORITY_RANK: Record<RecommendationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * `buildFollowUpRecommendations` ya entrega el arreglo ordenado
 * (`priority` -> `confidence` -> `recencyDays` -> `supportingCount`, ver
 * `sortRanked` en ese archivo), pero esta capa no depende de ese
 * detalle de implementación de otro módulo -- mismo criterio que
 * `rank-observations.ts`. Solo replica los dos criterios que sí son
 * públicos en `FollowUpRecommendation` (`priority`, `confidence`):
 * `recencyDays`/`supportingCount` son internos a ese archivo y nunca
 * viajan en el tipo público, así que un empate en ambos criterios
 * conserva el orden original (sort estable).
 */
export function rankRecommendations(recommendations: FollowUpRecommendation[]): FollowUpRecommendation[] {
  return [...recommendations].sort((a, b) => {
    const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.confidence - a.confidence;
  });
}
