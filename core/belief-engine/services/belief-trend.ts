import type { BeliefHistoryEntry } from "../entities/belief-history-entry";

export const BELIEF_TRENDS = ["new", "strengthening", "weakening", "stable"] as const;
export type BeliefTrend = (typeof BELIEF_TRENDS)[number];

/**
 * Deriva la tendencia a partir de `belief_history`, nunca de una
 * columna cacheada (ver docblock de `beliefs` en el schema) -- una
 * sola fuente de verdad para "se está fortaleciendo o debilitando".
 * Compara solo las últimas dos filas: la tendencia es sobre el cambio
 * más reciente, no un promedio de toda la vida del Belief.
 */
export function deriveBeliefTrend(history: BeliefHistoryEntry[]): BeliefTrend {
  if (history.length <= 1) {
    return "new";
  }

  const [previous, latest] = history.slice(-2);
  if (!previous || !latest) {
    return "new";
  }

  if (latest.newConfidence > previous.newConfidence) {
    return "strengthening";
  }
  if (latest.newConfidence < previous.newConfidence) {
    return "weakening";
  }
  return "stable";
}
