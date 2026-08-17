import { getLiveYoutubeContext } from "../../reality/get-live-youtube-context";
import type { Database } from "../../../core/db/client";
import type { LifeGraphContext } from "../../../core/life";
import { describeError } from "../../../core/observability/describe-error";
import { logger } from "../../../core/observability/logger";
import { recordEvent } from "../../../core/observability/record-event";
import type { ExternalSignal } from "../../../core/reality";
import type { YoutubeSnapshot } from "../../reality/domain";
import { buildYoutubeSignals } from "./youtube-signals";

/**
 * Mismo criterio exacto que `get-calendar-signals-for-conversation.ts`
 * -- `getLiveYoutubeContext` no es una consulta local barata, es una
 * llamada real contra YouTube Data API en cada lectura. Sin este
 * límite, cada mensaje de una conversación activa dispararía su propia
 * sincronización completa.
 *
 * Caché en memoria del proceso, nunca persistida -- mismo TTL que
 * calendario (3 min): bastante fresco para que la conversación se
 * sienta al día, bastante espaciado para no repetir la lectura en cada
 * turno de una charla activa.
 */
const CACHE_TTL_MS = 3 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; snapshot: YoutubeSnapshot | null }>();

/**
 * Nunca lanza -- una falla real de YouTube (credenciales expiradas,
 * API caída) no debe tumbar el resto de `RealitySnapshot`; se degrada a
 * "sin YouTube esta vez", mismo criterio de tolerancia a fallos que
 * `getCalendarContextForConversation`.
 */
async function getYoutubeSnapshotForConversation(
  db: Database,
  context: LifeGraphContext,
): Promise<YoutubeSnapshot | null> {
  const cached = cache.get(context.lifeGraphId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.snapshot;
  }

  try {
    const outcome = await getLiveYoutubeContext(db, context.lifeGraphId);
    const snapshot = outcome.status === "connected" ? outcome.snapshot : null;
    cache.set(context.lifeGraphId, { expiresAt: Date.now() + CACHE_TTL_MS, snapshot });
    return snapshot;
  } catch (error) {
    logger.log({
      event: "chat.youtube_context_failed",
      severity: "error",
      lifeGraphId: context.lifeGraphId,
      ...describeError(error),
    });
    await recordEvent(db, {
      type: "error",
      route: "chat.youtube_context_failed",
      message: error instanceof Error ? error.message : String(error),
    });
    return cached?.snapshot ?? null;
  }
}

/** Envoltorio sobre `getYoutubeSnapshotForConversation` -- para `assembleRealitySnapshot`, que solo necesita las señales. */
export async function getYoutubeSignalsForConversation(
  db: Database,
  context: LifeGraphContext,
): Promise<ExternalSignal[]> {
  const { signals, sanitizedCount } = buildYoutubeSignals(await getYoutubeSnapshotForConversation(db, context));

  if (sanitizedCount > 0) {
    await recordEvent(db, {
      type: "youtube_signal_sanitized",
      metadata: { count: sanitizedCount },
    });
  }

  return signals;
}
