import type { FollowUpRecommendation } from "../../dashboard/services/build-follow-up-recommendations";

/**
 * Recibe ya solo celebraciones, recortadas al mismo tope que
 * `recentProgress` (ver `partition-recommendations.ts` +
 * `cap-recommendations.ts`) -- antes este archivo filtraba
 * `CELEBRATE_PROGRESS` con su propio criterio, sobre el arreglo
 * completo sin recortar, lo que podía mencionar una celebración que
 * `PresenceState.recommendations` ni siquiera mostraba. Ahora
 * `encouragement` y `recentProgress` son siempre consistentes entre sí:
 * toda celebración que el texto menciona está también en la lista.
 *
 * Nunca elogia sin evidencia real: si `recentProgress` está vacío,
 * `null`, nunca una frase genérica de relleno (mismo criterio que
 * `continuityLine` en `build-morning-brief.ts`).
 */
export function buildEncouragement(recentProgress: FollowUpRecommendation[]): string | null {
  if (recentProgress.length === 0) return null;
  if (recentProgress.length === 1) return recentProgress[0].explanation;

  const titles = recentProgress.map((celebration) => celebration.relatedEntities[0]?.title ?? celebration.title);
  return `Hay ${recentProgress.length} cosas para celebrar hoy: ${titles.join(", ")}.`;
}
