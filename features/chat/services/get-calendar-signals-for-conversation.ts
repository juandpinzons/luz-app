import { getLiveCalendarContext } from "../../../core/calendar-connections/get-live-calendar-context";
import type { Database } from "../../../core/db/client";
import type { LifeGraphContext } from "../../../core/life";
import { describeError } from "../../../core/observability/describe-error";
import { logger } from "../../../core/observability/logger";
import type { ExternalSignal } from "../../../core/reality";
import { buildCalendarSignals } from "./calendar-signals";

/**
 * A diferencia de `assembleRealitySnapshot` (deliberadamente "nunca se
 * cachea entre requests" -- ver su docblock), el calendario necesita
 * un límite de frecuencia real y por una razón distinta: no es una
 * consulta local barata, es una sincronización real contra el
 * proveedor (CalDAV/Apple) en cada lectura -- `getLiveCalendarContext`
 * no reutiliza cursor ni eventos guardados (Calendar Foundation no
 * persiste nada todavía, ver `features/reality/README.md`, punto de
 * extensión #2). Sin este límite, cada mensaje de una conversación
 * activa dispararía su propia sincronización completa contra un
 * servidor externo -- exactamente el tipo de latencia añadida que la
 * misión "mejora la apertura del chat" (turno anterior) pidió eliminar,
 * y un riesgo real de límite de tasa contra la cuenta de iCloud de la
 * persona.
 *
 * Caché en memoria del proceso, nunca persistida -- funciona mejor en
 * una instancia tibia de Vercel, se pierde en una fría (degrada a una
 * sincronización más, nunca a un error). TTL corto (3 min): bastante
 * fresco para que la conversación se sienta al día, bastante espaciado
 * para no repetir la sincronización en cada turno de una charla activa.
 */
const CACHE_TTL_MS = 3 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; signals: ExternalSignal[] }>();

/**
 * Nunca lanza -- una falla real de calendario (credenciales
 * expiradas, CalDAV caído) no debe tumbar el resto de
 * `RealitySnapshot`; se degrada a "sin señales de calendario esta
 * vez", mismo criterio de tolerancia a fallos que ya usa
 * `getLiveCalendarContext` para sus propios estados esperados.
 */
export async function getCalendarSignalsForConversation(
  db: Database,
  context: LifeGraphContext,
): Promise<ExternalSignal[]> {
  const cached = cache.get(context.lifeGraphId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.signals;
  }

  try {
    const outcome = await getLiveCalendarContext(db, context.lifeGraphId);
    const signals = outcome.status === "connected" ? buildCalendarSignals(outcome.calendarContext) : [];
    cache.set(context.lifeGraphId, { expiresAt: Date.now() + CACHE_TTL_MS, signals });
    return signals;
  } catch (error) {
    logger.log({
      event: "chat.calendar_signals_failed",
      severity: "error",
      lifeGraphId: context.lifeGraphId,
      ...describeError(error),
    });
    return cached?.signals ?? [];
  }
}
