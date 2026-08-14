import type { Database } from "../../../core/db/client";
import type { LifeGraphContext } from "../../../core/life";
import { upsertDailyMetrics } from "../../../core/wearable-metrics/repository";
import type { WearableProvider } from "../providers/wearable-provider";

export interface ImportWearableExportResult {
  readonly daysImported: number;
}

/**
 * Único punto de entrada real de Wearable Foundation: parsea (vía el
 * puerto, nunca conociendo el formato del proveedor) + persiste (upsert
 * por día, ver `core/wearable-metrics/repository.ts`). `provider` lo
 * inyecta quien llama, ya construido -- mismo criterio de inyección de
 * dependencias que el resto de `features/reality/application`.
 */
export async function importWearableExport(
  db: Database,
  context: LifeGraphContext,
  provider: WearableProvider,
  raw: string,
): Promise<ImportWearableExportResult> {
  const result = provider.parseExport(raw);
  const daysImported = await upsertDailyMetrics(db, context.lifeGraphId, result.provider, result.dailyMetrics);
  return { daysImported };
}
