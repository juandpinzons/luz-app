import type { Database } from "../../../core/db/client";
import type { LifeGraphContext } from "../../../core/life";
import { describeError } from "../../../core/observability/describe-error";
import { logger } from "../../../core/observability/logger";
import { listDailyMetrics } from "../../../core/wearable-metrics/repository";
import type { ExternalSignal } from "../../../core/reality";
import { getWearableSnapshot } from "../../reality/application/get-wearable-snapshot";
import { buildWearableSignals } from "./wearable-signals";

/**
 * A diferencia de `getCalendarContextForConversation`, no hace falta
 * caché ni límite de frecuencia: `listDailyMetrics` es una lectura
 * local (sin llamada de red a un proveedor externo en cada mensaje,
 * ver docblock de `core/wearable-metrics/repository.ts`) sobre una
 * tabla de cardinalidad baja (días, no eventos). Mismo criterio de
 * tolerancia a fallos que Calendar: nunca lanza, una falla real se
 * degrada a "sin datos de reloj esta vez", nunca tumba el resto de
 * `RealitySnapshot`.
 */
export async function getWearableSignalsForConversation(
  db: Database,
  context: LifeGraphContext,
): Promise<ExternalSignal[]> {
  try {
    const dailyMetrics = await listDailyMetrics(db, context.lifeGraphId, "garmin");
    return buildWearableSignals(getWearableSnapshot(dailyMetrics));
  } catch (error) {
    logger.log({
      event: "chat.wearable_signals_failed",
      severity: "error",
      lifeGraphId: context.lifeGraphId,
      ...describeError(error),
    });
    return [];
  }
}
