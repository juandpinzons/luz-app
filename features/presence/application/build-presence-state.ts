import type { LifeDashboardSnapshot } from "../../dashboard/services/build-life-dashboard-snapshot";
import type { FollowUpRecommendation } from "../../dashboard/services/build-follow-up-recommendations";
import type { LifeObservation } from "../../dashboard/services/build-life-observations";
import type { PresenceState } from "../domain/presence-state";
import { buildEncouragement } from "../services/build-encouragement";
import { buildGreeting } from "../services/build-greeting";
import { capRecommendations } from "../services/cap-recommendations";
import { computeUrgency } from "../services/compute-urgency";
import { partitionRecommendations } from "../services/partition-recommendations";
import { pickFocus } from "../services/pick-focus";
import { rankRecommendations } from "../services/rank-recommendations";

/**
 * Punto de entrada público de la Capa de Presencia. Consume
 * exactamente los tres contratos ya calculados aguas arriba en
 * `features/dashboard/` -- ningún repositorio, ninguna consulta, ningún
 * motor nuevo, ninguna IA. Determinístico de punta a punta: mismas tres
 * entradas siempre producen el mismo `PresenceState`.
 *
 * Mismo orden de parámetros que `buildFollowUpRecommendations`
 * (`observations` antes que `snapshot`) -- `snapshot.observations` ya
 * es ese mismo arreglo, pasado aparte por la misma razón que allá.
 */
export function buildPresenceState(
  observations: LifeObservation[],
  snapshot: LifeDashboardSnapshot,
  recommendations: FollowUpRecommendation[],
): PresenceState {
  const { primaryFocus, secondaryFocus } = pickFocus(observations);

  const ranked = rankRecommendations(recommendations);
  const { actionable, celebratory } = partitionRecommendations(ranked);
  const recentProgress = capRecommendations(celebratory);

  return {
    asOf: snapshot.generatedAt,
    greeting: buildGreeting(snapshot.generatedAt),
    primaryFocus,
    secondaryFocus,
    attentionNeeded: capRecommendations(actionable),
    recentProgress,
    encouragement: buildEncouragement(recentProgress),
    urgency: computeUrgency(actionable),
  };
}
