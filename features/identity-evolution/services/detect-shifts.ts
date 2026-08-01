import type { IdentityShift } from "../domain/identity-shift";
import type { IdentityTrajectory } from "../domain/identity-trajectory";
import { COMPARISON_WINDOW_DAYS } from "./decay";
import { topUnitBy, type RankableUnit } from "./rank-identity";

function describeShift(unit: RankableUnit, comparisonWindowDays: number): string {
  const sign = unit.delta >= 0 ? "+" : "";
  return `De "${unit.previousMomentum}" a "${unit.momentum}" -- peso ${unit.weightAtComparisonCheckpoint} -> ${unit.weight} (${sign}${unit.delta}) en ${comparisonWindowDays} días.`;
}

/**
 * Un `IdentityShift` por cada unidad cuyo `momentum` cambió respecto a
 * su propio `previousMomentum` (ya calculado por `computeUnitTimelineWithHistory`,
 * ver `build-dimensions.ts`/`build-themes.ts`) -- nunca se vuelve a
 * tocar evidencia cruda aquí, es una comparación pura sobre lo que ya
 * se calculó. `"stable" -> "stable"` nunca genera un shift: eso es
 * ausencia de cambio, no una transición (mismo criterio que
 * `NarrativeState.recentChanges` solo lista lo que de verdad cambió).
 */
export function detectShifts(fullRanking: readonly RankableUnit[]): readonly IdentityShift[] {
  return fullRanking
    .filter((unit) => unit.momentum !== unit.previousMomentum)
    .map((unit) => ({
      unitKind: unit.unitKind,
      key: unit.key,
      label: unit.label,
      momentum: unit.momentum,
      previousMomentum: unit.previousMomentum,
      delta: unit.delta,
      detectedOverDays: COMPARISON_WINDOW_DAYS,
      description: describeShift(unit, COMPARISON_WINDOW_DAYS),
    }));
}

/**
 * Compara quién lideraba la identidad hace `COMPARISON_WINDOW_DAYS`
 * (ranking por `weightAtComparisonCheckpoint`) contra quién lidera hoy
 * (ranking por `weight`) -- la respuesta a "transition" del algoritmo
 * de evolución: no un estado de reposo por unidad (eso ya lo cubre
 * `IdentityMomentum`), sino si la identidad COMO UN TODO cambió de
 * dueño en el puesto #1. Reutiliza `topUnitBy` (`rank-identity.ts`) --
 * el mismo criterio de desempate que decide `primaryIdentity`, para que
 * `trajectory.primaryKey` nunca pueda contradecir a
 * `IdentitySnapshot.primaryIdentity.key` por dos rankings con
 * desempates distintos.
 */
export function detectTrajectory(fullRanking: readonly RankableUnit[]): IdentityTrajectory {
  const currentPrimary = topUnitBy(fullRanking, (unit) => unit.weight);
  const previousPrimary = topUnitBy(fullRanking, (unit) => unit.weightAtComparisonCheckpoint);

  if (!currentPrimary) {
    return {
      state: "insufficient_evidence",
      primaryKey: null,
      previousPrimaryKey: previousPrimary?.key ?? null,
      description: "Todavía no hay suficiente evidencia real para afirmar una identidad principal.",
    };
  }

  if (!previousPrimary || previousPrimary.key !== currentPrimary.key) {
    return {
      state: "transitioning",
      primaryKey: currentPrimary.key,
      previousPrimaryKey: previousPrimary?.key ?? null,
      description: previousPrimary
        ? `"${currentPrimary.label}" reemplazó a "${previousPrimary.label}" como identidad principal en los últimos ${COMPARISON_WINDOW_DAYS} días.`
        : `"${currentPrimary.label}" se consolidó como identidad principal por primera vez en los últimos ${COMPARISON_WINDOW_DAYS} días.`,
    };
  }

  return {
    state: "consolidating",
    primaryKey: currentPrimary.key,
    previousPrimaryKey: previousPrimary.key,
    description: `"${currentPrimary.label}" se mantiene como identidad principal desde hace al menos ${COMPARISON_WINDOW_DAYS} días.`,
  };
}
