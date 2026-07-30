import type { LifeDashboardSnapshot } from "../../dashboard/services/build-life-dashboard-snapshot";
import type { FollowUpRecommendation } from "../../dashboard/services/build-follow-up-recommendations";
import type { LifeObservation } from "../../dashboard/services/build-life-observations";
import type { HomeLifeContext } from "../domain/home-state";

/** Único punto donde `HomeState` lee el snapshot directamente -- `totals`/`domains`/`relationships` ya vienen calculados, esto es indexación en memoria, no una consulta nueva. */
export function buildLifeContext(
  snapshot: LifeDashboardSnapshot,
  observations: LifeObservation[],
  recommendations: FollowUpRecommendation[],
): HomeLifeContext {
  return {
    totals: snapshot.totals,
    domains: snapshot.domains,
    relationships: snapshot.relationships,
    observationCount: observations.length,
    recommendationCount: recommendations.length,
  };
}
