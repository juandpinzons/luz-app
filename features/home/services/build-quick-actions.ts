import type { FollowUpRecommendation } from "../../dashboard/services/build-follow-up-recommendations";
import type { HomeQuickAction } from "../domain/home-state";

/** Una acción rápida por recomendación accionable -- proyección directa de `suggestedAction`, nunca una decisión nueva sobre qué mostrar. Recibe `HomeState.attentionNeeded` ya decidido por Presence, nunca vuelve a filtrar por tipo/prioridad. */
export function buildQuickActions(attentionNeeded: FollowUpRecommendation[]): HomeQuickAction[] {
  return attentionNeeded.map((recommendation) => ({
    recommendationId: recommendation.id,
    label: recommendation.title,
    action: recommendation.suggestedAction,
  }));
}
