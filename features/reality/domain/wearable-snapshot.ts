import type { DailyWearableMetrics } from "./wearable-daily-metrics";

/**
 * Promedios de una ventana reciente -- `undefined` por campo cuando
 * ningún día de la ventana trajo ese dato (nunca 0 inventado). Mismo
 * criterio de ausencia real que el resto de `features/reality/domain`.
 */
export interface WearableTrend {
  readonly windowDays: number;
  readonly averageSteps?: number;
  readonly averageSleepMinutes?: number;
  readonly averageStressLevel?: number;
}

/**
 * La vista canónica de bienestar que el resto de LUZ consume -- mismo
 * rol que `CalendarSnapshot`/`EmailSnapshot`. `latestDay`/`trend`/
 * `lowSleepAlert`/`elevatedStressAlert` SON las señales de producto
 * (mismo criterio que Calendar/Email: campos directos, nunca una
 * lista genérica envuelta en un tipo "Signal"), calculadas de forma
 * pura a partir de las métricas persistidas -- ver
 * `../application/get-wearable-snapshot.ts` para las reglas exactas
 * de cada una.
 */
export interface WearableSnapshot {
  readonly hasData: boolean;
  readonly latestDay?: DailyWearableMetrics;
  readonly trend?: WearableTrend;
  /** El sueño de `latestDay` está notablemente por debajo de lo saludable (umbral en el ensamblador). */
  readonly lowSleepAlert: boolean;
  /** El estrés promedio de `latestDay` está notablemente elevado (umbral en el ensamblador). */
  readonly elevatedStressAlert: boolean;
}
