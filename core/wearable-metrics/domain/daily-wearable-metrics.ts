/**
 * Desglose de fases de sueño de UNA noche, en minutos -- mismo nivel
 * de detalle que el export de bienestar de Garmin expone (deep/light/
 * rem/awake). Opcional en `SleepMetrics.stages`: algunas noches solo
 * traen el total, sin desglose por fase.
 */
export interface SleepStageBreakdown {
  readonly deepMinutes: number;
  readonly lightMinutes: number;
  readonly remMinutes: number;
  readonly awakeMinutes: number;
}

export interface SleepMetrics {
  readonly totalMinutes: number;
  readonly stages?: SleepStageBreakdown;
  /** 0-100, tal cual la puntuación de calidad que reporta el proveedor -- nunca recalculada por LUZ. */
  readonly qualityScore?: number;
}

/**
 * Vista de bienestar de UN día calendario, ya normalizada a
 * vocabulario de producto -- ningún campo específico de Garmin
 * (`SummaryId`, `ParticipantID`, formas de su Health API, etc.) cruza
 * este límite, mismo criterio que `CalendarEvent`/`EmailMessage`.
 * `date` es el día calendario que el dispositivo asignó a estas
 * métricas (zona horaria ya resuelta por el proveedor), no un
 * instante -- comparar por igualdad de string ("2026-08-13"), nunca
 * como `Date` con hora.
 */
export interface DailyWearableMetrics {
  readonly date: string;
  readonly steps?: number;
  readonly restingHeartRateBpm?: number;
  /** 0-100, escala de estrés promedio del día tal cual la reporta el proveedor. */
  readonly averageStressLevel?: number;
  readonly sleep?: SleepMetrics;
}
