import type { IdentityConfidence } from "../domain/identity-confidence";
import type { IdentityMomentum } from "../domain/identity-momentum";
import {
  COMPARISON_WINDOW_DAYS,
  DORMANT_WEIGHT_THRESHOLD,
  LOOKBACK_DAYS,
  PEAK_CHECKPOINT_STEP_DAYS,
  RECENCY_DECAY_DAYS,
  RENEWAL_GAP_DAYS,
  SIGNIFICANCE_THRESHOLD,
  STABILITY_THRESHOLD,
  ageDays,
  weightFromEvents,
  type IdentityEvidenceEvent,
} from "./decay";

export interface UnitTimelineResult {
  readonly weight: number;
  readonly peakWeight: number;
  readonly weightAtComparisonCheckpoint: number;
  readonly delta: number;
  readonly momentum: IdentityMomentum;
  /** Explicación técnica y numérica -- audiencia: debugging/explicabilidad (Principio 3), distinta de `IdentityRepresentation.summary` (audiencia: consumidor final, ver `derive-representation.ts`). */
  readonly momentumReason: string;
  readonly confidence: IdentityConfidence;
  readonly earliestEvidenceAgeDays: number | null;
  readonly latestEvidenceAgeDays: number | null;
  readonly evidenceCount: number;
}

interface TimelineOptions {
  /** Horizonte duro de evidencia -- ver `LOOKBACK_DAYS`. */
  readonly lookbackDays?: number;
  /** Horizonte de decaimiento -- ver `RECENCY_DECAY_DAYS`. Distinto de `lookbackDays` a propósito. */
  readonly recencyDecayDays?: number;
  readonly comparisonWindowDays?: number;
}

function subDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * `peakWeight` -- el mayor `weight` observado en checkpoints regulares
 * a lo largo de `lookbackDays` (no `recencyDecayDays`: un pico real
 * pudo haber ocurrido hace más de 90 días, y precisamente ESO es lo que
 * `peakWeight` existe para no perder), cada uno simulando "¿cómo se
 * habría leído esto desde ese punto en el tiempo, con solo la evidencia
 * que existía hasta entonces, y con la MISMA rampa de decaimiento de
 * `recencyDecayDays` días vigente en ese momento?" (`weightFromEvents`
 * ya excluye evidencia futura a su propio `asOf` -- ver docblock de
 * `decay.ts`). Muestreo cada `PEAK_CHECKPOINT_STEP_DAYS`, no cada día
 * -- una aproximación documentada, no el máximo teórico exacto.
 */
function computePeakWeight(
  events: readonly IdentityEvidenceEvent[],
  now: Date,
  lookbackDays: number,
  recencyDecayDays: number,
): number {
  let peak = 0;
  for (let checkpointDays = 0; checkpointDays <= lookbackDays; checkpointDays += PEAK_CHECKPOINT_STEP_DAYS) {
    const asOf = subDays(now, checkpointDays);
    peak = Math.max(peak, weightFromEvents(events, asOf, recencyDecayDays));
  }
  return peak;
}

/**
 * `true` cuando hubo un silencio real (>= `RENEWAL_GAP_DAYS`) entre la
 * última evidencia "vieja" (anterior a la ventana de comparación) y el
 * inicio de esa ventana -- lo que separa `renewing` (un regreso tras
 * silencio real) de `emerging` (crecimiento continuo, sin haber pasado
 * por un bache). Mira hasta `lookbackDays` atrás (no solo
 * `recencyDecayDays`) porque un regreso real casi siempre implica una
 * evidencia "vieja" más allá de la ventana de decaimiento. Si no hay
 * ninguna evidencia anterior a la ventana de comparación, nunca es
 * `renewing` -- no hay nada de qué "regresar".
 */
function hasQuietGapBeforeRise(
  events: readonly IdentityEvidenceEvent[],
  now: Date,
  comparisonWindowDays: number,
  lookbackDays: number,
): boolean {
  let mostRecentPriorAgeDays: number | null = null;
  for (const event of events) {
    const age = ageDays(event.occurredAt, now);
    if (age < comparisonWindowDays || age > lookbackDays) continue;
    if (mostRecentPriorAgeDays === null || age < mostRecentPriorAgeDays) {
      mostRecentPriorAgeDays = age;
    }
  }
  if (mostRecentPriorAgeDays === null) return false;
  const gapDays = mostRecentPriorAgeDays - comparisonWindowDays;
  return gapDays >= RENEWAL_GAP_DAYS;
}

/**
 * Exportada aparte (además de usarse internamente) porque
 * `application/build-identity-snapshot.ts` la reutiliza para
 * `overallConfidence` -- misma fórmula, aplicada al conjunto completo
 * de evidencia en vez de a una sola unidad. Usa `lookbackDays` (no
 * `recencyDecayDays`): la confianza pregunta "¿cuánta evidencia real
 * respalda esta lectura, en TODO el horizonte considerado?", un eje
 * distinto de `weight` (que sí debe apagarse sin refuerzo reciente).
 */
export function computeConfidence(events: readonly IdentityEvidenceEvent[], now: Date, lookbackDays: number): IdentityConfidence {
  const withinWindow = events.filter((event) => {
    const age = ageDays(event.occurredAt, now);
    return age >= 0 && age <= lookbackDays;
  });
  const weekBuckets = new Set(withinWindow.map((event) => Math.floor(ageDays(event.occurredAt, now) / 7)));
  const evidenceCount = withinWindow.length;
  const timeSpreadWeeks = weekBuckets.size;
  const score = Math.max(
    0,
    Math.min(100, Math.min(60, evidenceCount * 10) + Math.min(40, timeSpreadWeeks * 4)),
  );
  return {
    score,
    evidenceCount,
    timeSpreadWeeks,
    reason:
      evidenceCount === 0
        ? "Sin evidencia real todavía."
        : `${evidenceCount} evidencia(s) real(es) repartidas en ${timeSpreadWeeks} semana(s) distinta(s).`,
  };
}

function classifyMomentum(
  weight: number,
  weightAtComparisonCheckpoint: number,
  peakWeight: number,
  delta: number,
  hasGap: boolean,
): IdentityMomentum {
  // "Ya tocó fondo": hoy Y hace `comparisonWindowDays` ambos por debajo
  // del umbral -- deliberadamente NO exige `|delta| <= STABILITY_THRESHOLD`:
  // dos números ya pequeños pueden diferir un poco entre sí sin que eso
  // sea una "caída en curso" (ver README, "Debilidad conocida" -- un
  // ejemplo real de este ajuste). Una caída todavía EN PROGRESO (ej.
  // checkpoint alto, hoy bajo) no cumple esto y sigue cayendo en
  // `declining` más abajo, como debe ser.
  if (
    peakWeight >= SIGNIFICANCE_THRESHOLD &&
    weight < DORMANT_WEIGHT_THRESHOLD &&
    weightAtComparisonCheckpoint < DORMANT_WEIGHT_THRESHOLD
  ) {
    return "dormant";
  }
  if (delta > STABILITY_THRESHOLD) {
    return peakWeight >= SIGNIFICANCE_THRESHOLD && hasGap ? "renewing" : "emerging";
  }
  if (delta < -STABILITY_THRESHOLD) {
    return "declining";
  }
  return "stable";
}

function describeMomentum(
  momentum: IdentityMomentum,
  weight: number,
  peakWeight: number,
  delta: number,
  comparisonWindowDays: number,
): string {
  switch (momentum) {
    case "dormant":
      return `Llegó a pesar ${peakWeight}, hoy pesa ${weight} y ya no sigue cayendo (cambio de ${delta} en ${comparisonWindowDays} días).`;
    case "renewing":
      return `Volvió a crecer tras un silencio real -- llegó a pesar ${peakWeight} antes, y subió ${delta} puntos en los últimos ${comparisonWindowDays} días.`;
    case "emerging":
      return `Creciendo sin historial previo significativo -- subió ${delta} puntos en los últimos ${comparisonWindowDays} días.`;
    case "declining":
      return `Perdiendo peso -- cayó ${Math.abs(delta)} puntos en los últimos ${comparisonWindowDays} días.`;
    case "stable":
      return `Sin cambio real en los últimos ${comparisonWindowDays} días (${delta >= 0 ? "+" : ""}${delta} puntos).`;
  }
}

/**
 * El algoritmo completo para UN `IdentityDimension`/`IdentityTheme` --
 * misma función para ambos grados (`build-dimensions.ts`/
 * `build-themes.ts` solo difieren en cómo agrupan sus eventos en
 * `IdentityEvidenceEvent[]`), para que la fórmula de peso/momentum
 * viva en un solo lugar. Determinista: mismas `events` + mismo `now`
 * siempre producen el mismo resultado.
 */
export function computeUnitTimeline(
  events: readonly IdentityEvidenceEvent[],
  now: Date,
  options?: TimelineOptions,
): UnitTimelineResult {
  const lookbackDays = options?.lookbackDays ?? LOOKBACK_DAYS;
  const recencyDecayDays = options?.recencyDecayDays ?? RECENCY_DECAY_DAYS;
  const comparisonWindowDays = options?.comparisonWindowDays ?? COMPARISON_WINDOW_DAYS;

  const withinWindow = events.filter((event) => {
    const age = ageDays(event.occurredAt, now);
    return age >= 0 && age <= lookbackDays;
  });

  const weight = weightFromEvents(events, now, recencyDecayDays);
  const weightAtComparisonCheckpoint = weightFromEvents(events, subDays(now, comparisonWindowDays), recencyDecayDays);
  const delta = weight - weightAtComparisonCheckpoint;
  const peakWeight = computePeakWeight(events, now, lookbackDays, recencyDecayDays);
  const hasGap = hasQuietGapBeforeRise(events, now, comparisonWindowDays, lookbackDays);
  const momentum = classifyMomentum(weight, weightAtComparisonCheckpoint, peakWeight, delta, hasGap);

  const ages = withinWindow.map((event) => ageDays(event.occurredAt, now));

  return {
    weight,
    peakWeight,
    weightAtComparisonCheckpoint,
    delta,
    momentum,
    momentumReason: describeMomentum(momentum, weight, peakWeight, delta, comparisonWindowDays),
    confidence: computeConfidence(events, now, lookbackDays),
    earliestEvidenceAgeDays: ages.length > 0 ? Math.max(...ages) : null,
    latestEvidenceAgeDays: ages.length > 0 ? Math.min(...ages) : null,
    evidenceCount: withinWindow.length,
  };
}

export interface UnitTimelineWithHistory {
  readonly current: UnitTimelineResult;
  /**
   * `momentum` recalculado con el mismo algoritmo, anclado en
   * `now - comparisonWindowDays` en vez de `now` -- es decir, "¿qué
   * habría dicho este mismo cálculo si se hubiera corrido hace
   * `comparisonWindowDays`?" (con su propia ventana de comparación
   * recursiva, `now - 2*comparisonWindowDays`). Recursivamente
   * consistente con `current.momentum`, nunca una heurística aparte --
   * es la base de `services/detect-shifts.ts`.
   */
  readonly previousMomentum: IdentityMomentum;
}

/**
 * Corre `computeUnitTimeline` dos veces (hoy, y hace
 * `comparisonWindowDays`) para que `build-dimensions.ts`/
 * `build-themes.ts` puedan poblar `previousMomentum` sin que
 * `detect-shifts.ts` necesite volver a tocar evidencia cruda -- ver
 * docblock de `previousMomentum` en `domain/identity-dimension.ts`.
 */
export function computeUnitTimelineWithHistory(
  events: readonly IdentityEvidenceEvent[],
  now: Date,
  options?: TimelineOptions,
): UnitTimelineWithHistory {
  const comparisonWindowDays = options?.comparisonWindowDays ?? COMPARISON_WINDOW_DAYS;
  const current = computeUnitTimeline(events, now, options);
  const previous = computeUnitTimeline(events, subDays(now, comparisonWindowDays), options);
  return { current, previousMomentum: previous.momentum };
}
