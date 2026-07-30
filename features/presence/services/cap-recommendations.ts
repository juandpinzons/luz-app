import type { FollowUpRecommendation } from "../../dashboard/services/build-follow-up-recommendations";

/**
 * La Capa de Presencia abre el día, no reemplaza el Dashboard completo
 * (`LIFE_DASHBOARD_SNAPSHOT_V1.md`) -- mostrar todo el arreglo aquí
 * sería la misma sobrecarga que `PRESENCE_PRINCIPLES.md` pide evitar.
 * Mismo tope para accionables y celebraciones -- ninguna categoría
 * tiene más peso visual que la otra por defecto.
 */
export const MAX_ITEMS_PER_SECTION = 3;

/** Recorta un arreglo ya ordenado (ver `rank-recommendations.ts`) -- nunca reordena. */
export function capRecommendations(recommendations: FollowUpRecommendation[]): FollowUpRecommendation[] {
  return recommendations.slice(0, MAX_ITEMS_PER_SECTION);
}
