import type { EvolutionEventKind } from "../../../core/temporal-evolution";

/**
 * Constantes de calibración del algoritmo de peso -- todas lineales,
 * ninguna exponencial ni logarítmica a propósito: mismo idioma
 * aritmético que ya usa el resto del repo para decaimiento/importancia
 * (`core/belief-engine/services/decay-stale-beliefs.ts` usa pasos fijos
 * cada 90 días; `core/importance-engine/scoring/deterministic-importance-scoring-strategy.ts`
 * usa una rampa lineal de recencia sobre 60 días) -- una fórmula que se
 * explica en una frase ("la evidencia pierde peso en línea recta hasta
 * el día N") es más auditable que una que necesita cálculo para
 * entenderse, y esto es exactamente el tipo de número que el Founder o
 * un consumidor futuro debe poder verificar a mano.
 *
 * Primera iteración, no un techo -- Principio 1 del motor
 * (`evolving capability, not limitation`): estos valores son un punto
 * de partida razonable sin datos reales de uso todavía (Alpha, pocos
 * usuarios), pensados para recalibrarse con evidencia real, nunca
 * como una verdad matemática definitiva sobre cómo evoluciona una
 * identidad humana.
 */

/**
 * Horizonte duro de evidencia -- más vieja que esto, ni siquiera cuenta
 * para `evidenceCount`/`earliestEvidenceAgeDays`/el muestreo de
 * `peakWeight` (aunque la fila original en `core/belief-engine`/
 * `core/concept-graph` sigue intacta para siempre; esto es solo hasta
 * dónde ESTE snapshot mira). Suficiente para ver un pico hace ~6 meses
 * y su declive completo después, con margen -- mismo horizonte que el
 * ejemplo de la misión ("hace seis meses" seguía pesando 95).
 */
export const LOOKBACK_DAYS = 365;

/**
 * Horizonte de decaimiento -- el que de verdad determina `weight`
 * (distinto de `LOOKBACK_DAYS`, que solo decide qué evidencia se
 * considera que existe). Deliberadamente más corto: si se usara
 * `LOOKBACK_DAYS` completo como rampa, una racha real de meses de
 * evidencia vieja (ej. "habló de esto todos los días" hace 8-12 meses)
 * podría seguir sumando raw score suficiente para saturar `weight` HOY
 * -- exactamente lo que la misión prohíbe ("anxiety... no longer
 * identity" tras 8 meses de silencio). Con `RECENCY_DECAY_DAYS = 90`,
 * cualquier evidencia sin refuerzo en los últimos ~3 meses deja de
 * aportar del todo a `weight`, sin importar cuánta haya habido antes --
 * la única forma de mantener `weight` alto es seguir generando
 * evidencia real, no haber generado mucha alguna vez.
 */
export const RECENCY_DECAY_DAYS = 90;

/** Ventana de "cambio reciente" para `delta`/`momentum`/`IdentityShift` -- deliberadamente varias semanas, nunca un solo mensaje ("not instantly, not after one message", instrucción explícita de la misión). */
export const COMPARISON_WINDOW_DAYS = 45;

/** `|delta| <= esto` cuenta como "sin cambio real" -- protege contra que ruido normal (una semana más activa que otra) se lea como una transición de identidad. */
export const STABILITY_THRESHOLD = 6;

/** `peakWeight` por encima de esto significa "esto SÍ fue una parte real de la identidad alguna vez" -- separa un capítulo genuino de un tema que nunca llegó a pesar nada. */
export const SIGNIFICANCE_THRESHOLD = 40;

/** `weight` por debajo de esto, con un `peakWeight` significativo y sin caída activa, es `dormant` -- ya tocó fondo. */
export const DORMANT_WEIGHT_THRESHOLD = 15;

/** `weight` por debajo de esto no cuenta como parte de la identidad ACTUAL para efectos de ranking (`primaryIdentity`/`stableThemes`) -- sigue existiendo en `dimensions`/`themes`, solo no compite por protagonismo. */
export const PRESENCE_THRESHOLD = 8;

/** Silencio real mínimo, en días, para que una subida cuente como `renewing` (un regreso) en vez de `emerging` (algo nuevo). */
export const RENEWAL_GAP_DAYS = 60;

/** Puntos de evidencia decaída que equivalen a `weight: 100` -- lineal y capado, mismo criterio que `Math.min(60, evidenceCount * 12)` en `core/importance-engine`. */
export const SCORE_SATURATION_POINTS = 14;

/** Checkpoints usados para `peakWeight` -- cada 30 días a lo largo de `LOOKBACK_DAYS` (13 puntos), no cada día: `peakWeight` busca "¿hubo un pico real?", no el máximo teórico entre dos evidencias consecutivas. */
export const PEAK_CHECKPOINT_STEP_DAYS = 30;

/**
 * Peso base por tipo de señal -- cuánto "vale" un evento de evidencia
 * antes de aplicar decaimiento por recencia. Números pequeños y
 * enteros a propósito (mismo criterio que `ImportanceSignals`): fáciles
 * de sumar a mano al leer `IdentityConfidence.reason`.
 *
 * `insight_discovered` nunca lleva `domain` (ver `EvolutionEvent` en
 * `core/temporal-evolution`), así que en la práctica nunca participa
 * del cálculo por dimensión -- se mantiene aquí por completitud y para
 * un futuro uso a nivel de confianza general del snapshot.
 */
export const SIGNAL_BASE_WEIGHT: Record<EvolutionEventKind | "concept_evidence", number> = {
  belief_created: 3,
  belief_strengthened: 2,
  belief_weakened: 2,
  belief_expired: 1,
  belief_retracted: 1,
  insight_discovered: 2,
  concept_evidence: 3,
};

/** Un evento de evidencia ya reducido a lo único que el algoritmo de peso necesita -- generado a partir de `EvolutionEvent` (dimensiones) o `ConceptEvidence` (temas), ver `build-dimensions.ts`/`build-themes.ts`. */
export interface IdentityEvidenceEvent {
  readonly occurredAt: Date;
  readonly weight: number;
}

export function ageDays(occurredAt: Date, now: Date): number {
  return (now.getTime() - occurredAt.getTime()) / (1000 * 60 * 60 * 24);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Rampa lineal: 1.0 hoy, 0.0 en `recencyDecayDays` atrás o más -- ver docblock del módulo para por qué lineal y no exponencial, y por qué esta ventana es más corta que `LOOKBACK_DAYS`. */
export function recencyMultiplier(evidenceAgeDays: number, recencyDecayDays: number): number {
  if (evidenceAgeDays < 0) return 1;
  return clamp(1 - evidenceAgeDays / recencyDecayDays, 0, 1);
}

/**
 * Suma de evidencia decaída -> `weight` 0-100. Única función que
 * conoce `SCORE_SATURATION_POINTS` -- toda la lógica de peso pasa por
 * aquí, tanto para dimensiones como para temas (`compute-unit-timeline.ts`).
 * `recencyDecayDays` (no `LOOKBACK_DAYS`) es quien decide cuánto pesa
 * cada evento -- ver docblock de `RECENCY_DECAY_DAYS`.
 */
export function weightFromEvents(
  events: readonly IdentityEvidenceEvent[],
  asOf: Date,
  recencyDecayDays: number = RECENCY_DECAY_DAYS,
): number {
  let raw = 0;
  for (const event of events) {
    const age = ageDays(event.occurredAt, asOf);
    if (age < 0) continue;
    raw += event.weight * recencyMultiplier(age, recencyDecayDays);
  }
  return clamp(Math.round((raw / SCORE_SATURATION_POINTS) * 100), 0, 100);
}
