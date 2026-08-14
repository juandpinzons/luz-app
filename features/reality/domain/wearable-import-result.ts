import type { DailyWearableMetrics } from "./wearable-daily-metrics";
import type { WearableProviderKind } from "./wearable-provider-kind";

/**
 * Resultado de parsear UN archivo/export ya en manos de la persona --
 * a diferencia de `CalendarSyncResult`/`EmailSyncResult` (una página
 * de una sincronización EN VIVO contra un servidor), esto no tiene
 * `cursor` ni `hasMore`: no hay servidor al que volver a preguntarle
 * por más, todo lo que existe ya está en el archivo. `dailyMetrics`
 * puede traer fechas repetidas entre dos imports distintos -- la capa
 * de aplicación decide cómo fusionar (upsert por fecha), nunca este
 * tipo.
 */
export interface WearableImportResult {
  readonly provider: WearableProviderKind;
  readonly dailyMetrics: readonly DailyWearableMetrics[];
}
