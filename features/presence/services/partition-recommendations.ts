import type { FollowUpRecommendation } from "../../dashboard/services/build-follow-up-recommendations";

export interface RecommendationPartition {
  /** Todo lo que pide una acción real -- nunca `CELEBRATE_PROGRESS` ni `NO_ACTION`. */
  actionable: FollowUpRecommendation[];
  /** Solo `CELEBRATE_PROGRESS` -- única fuente de `recentProgress`/`encouragement`. */
  celebratory: FollowUpRecommendation[];
}

/**
 * Único lugar que decide qué tipo de recomendación es "accionable" vs
 * "para celebrar" vs "ninguna de las dos" (`NO_ACTION`, hoy nunca
 * construido por `buildFollowUpRecommendations` pero definido en su
 * union -- se descarta aquí igual, por si acaso). Antes de esto,
 * `build-encouragement.ts` y `compute-urgency.ts` repetían cada uno su
 * propio filtro sobre el mismo arreglo, con criterios ligeramente
 * distintos entre sí -- ahora ambos reciben ya la lista que les
 * corresponde, sin volver a decidir nada.
 */
export function partitionRecommendations(recommendations: FollowUpRecommendation[]): RecommendationPartition {
  const actionable: FollowUpRecommendation[] = [];
  const celebratory: FollowUpRecommendation[] = [];

  for (const recommendation of recommendations) {
    if (recommendation.type === "NO_ACTION") continue;
    if (recommendation.type === "CELEBRATE_PROGRESS") {
      celebratory.push(recommendation);
    } else {
      actionable.push(recommendation);
    }
  }

  return { actionable, celebratory };
}
