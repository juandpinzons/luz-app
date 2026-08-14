import type { DailyWearableMetrics } from "../domain/wearable-daily-metrics";
import type { WearableSnapshot, WearableTrend } from "../domain/wearable-snapshot";

const TREND_WINDOW_DAYS = 7;

/** Menos de 6h -- umbral de partida razonable (rango general de sueño saludable para un adulto), no una recomendación clínica. Ajustable si la evidencia de uso real lo pide. */
const LOW_SLEEP_MINUTES_THRESHOLD = 360;
/** Escala de estrés de Garmin: 0-25 bajo, 26-50 medio, 51-75 alto, 76-100 muy alto -- "elevado" es la franja alta/muy alta. */
const ELEVATED_STRESS_THRESHOLD = 50;

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildTrend(recentDays: readonly DailyWearableMetrics[]): WearableTrend | undefined {
  if (recentDays.length === 0) return undefined;

  return {
    windowDays: recentDays.length,
    averageSteps: average(recentDays.map((day) => day.steps).filter((v): v is number => v !== undefined)),
    averageSleepMinutes: average(
      recentDays.map((day) => day.sleep?.totalMinutes).filter((v): v is number => v !== undefined),
    ),
    averageStressLevel: average(
      recentDays.map((day) => day.averageStressLevel).filter((v): v is number => v !== undefined),
    ),
  };
}

/**
 * Construye la vista canónica de producto (`WearableSnapshot`,
 * `../domain`) a partir de métricas ya persistidas -- pura, sin I/O,
 * sin conocer ningún proveedor. `dailyMetrics` se espera ya ordenado
 * más reciente primero (mismo orden que devuelve
 * `core/wearable-metrics/repository.ts#listDailyMetrics`).
 */
export function getWearableSnapshot(dailyMetrics: readonly DailyWearableMetrics[]): WearableSnapshot {
  if (dailyMetrics.length === 0) {
    return { hasData: false, lowSleepAlert: false, elevatedStressAlert: false };
  }

  const [latestDay] = dailyMetrics;
  const recentWindow = dailyMetrics.slice(0, TREND_WINDOW_DAYS);

  return {
    hasData: true,
    latestDay,
    trend: buildTrend(recentWindow),
    lowSleepAlert:
      latestDay.sleep !== undefined && latestDay.sleep.totalMinutes < LOW_SLEEP_MINUTES_THRESHOLD,
    elevatedStressAlert:
      latestDay.averageStressLevel !== undefined && latestDay.averageStressLevel > ELEVATED_STRESS_THRESHOLD,
  };
}
