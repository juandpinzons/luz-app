import type { DomainMovement } from "../entities/domain-movement";
import type { PendingPrediction } from "../entities/pending-prediction";
import type { PredictivePatternCandidate } from "../entities/predictive-pattern-candidate";

/** Mismo criterio de "reciente" que `detectDomainCoMovement` -- un gatillo más viejo que esto ya no cuenta como "poco después". */
const WINDOW_DAYS = 21;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * Pura, sin IO -- convierte patrones ya confirmados
 * (`detectDomainCoMovement`, siempre >=2 ocurrencias) en predicciones
 * concretas: "el gatillo de este patrón acaba de repetirse, y la
 * consecuencia todavía no se vio". Nunca inventa un patrón nuevo a
 * partir de una sola ocurrencia -- solo reutiliza los que
 * `detectDomainCoMovement` ya validó, así que la confianza sigue
 * siendo la del patrón original (`computePatternConfidence`).
 */
export function derivePendingPredictions(
  candidates: PredictivePatternCandidate[],
  movements: DomainMovement[],
  now: Date = new Date(),
): PendingPrediction[] {
  const predictions: PendingPrediction[] = [];

  for (const candidate of candidates) {
    const trigger = movements
      .filter((m) => m.domain === candidate.fromDomain && m.direction === candidate.fromDirection)
      .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())[0];

    if (!trigger) continue;
    if (now.getTime() - trigger.changedAt.getTime() > WINDOW_MS) continue;

    const alreadyFollowed = movements.some(
      (m) =>
        m.domain === candidate.toDomain &&
        m.direction === candidate.toDirection &&
        m.changedAt.getTime() > trigger.changedAt.getTime(),
    );
    if (alreadyFollowed) continue;

    predictions.push({
      fromDomain: candidate.fromDomain,
      fromDirection: candidate.fromDirection,
      toDomain: candidate.toDomain,
      toDirection: candidate.toDirection,
      occurrences: candidate.occurrences,
      triggeredAt: trigger.changedAt,
      sampleFromBeliefId: trigger.beliefId,
    });
  }

  return predictions;
}
