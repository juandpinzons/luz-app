import type { FollowUpRecommendation } from "../../dashboard/services/build-follow-up-recommendations";
import type { PresenceUrgencyLevel } from "../domain/presence-state";

const URGENCY_RANK: Record<PresenceUrgencyLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/**
 * Recibe únicamente el lado accionable de `partitionRecommendations`
 * (nunca celebraciones) -- antes este archivo repetía su propio filtro
 * de exclusión de `CELEBRATE_PROGRESS`/`NO_ACTION`, duplicado del que
 * ya aplicaba `build-encouragement.ts` sobre el mismo arreglo. Un solo
 * lugar decide ahora qué cuenta como "accionable".
 *
 * Recibe la lista completa (sin recortar a `MAX_ITEMS_PER_SECTION`)
 * para que el tope de cuántas recomendaciones se muestran nunca pueda
 * cambiar el nivel de urgencia calculado.
 */
export function computeUrgency(actionable: FollowUpRecommendation[]): PresenceUrgencyLevel {
  let highest: PresenceUrgencyLevel = "low";

  for (const recommendation of actionable) {
    if (URGENCY_RANK[recommendation.priority] > URGENCY_RANK[highest]) {
      highest = recommendation.priority;
    }
  }

  return highest;
}
