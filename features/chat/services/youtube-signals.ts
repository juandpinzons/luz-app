import type { ExternalSignal } from "../../../core/reality";
import type { YoutubeSnapshot, YoutubeVideo } from "../../reality/domain";
import { sanitizeExternalText } from "./sanitize-external-text";

/**
 * Pura a propósito -- mismo criterio que `calendar-signals.ts`: sin
 * esta separación, cualquier import de `buildYoutubeSignals` arrastraría
 * `getLiveYoutubeContext` y, con él, la validación de variables de
 * entorno, rompiendo la posibilidad de probar esto sin una base de
 * datos real.
 */

/**
 * `video.title` lo escribe el CREADOR del video -- nunca la persona
 * dueña de LUZ ni LUZ misma (mismo motivo exacto que
 * `event.title`/`event.location` en `calendar-signals.ts`). Sanitizado
 * con la misma defensa compartida contra inyección de prompt.
 */
function describeVideo(video: YoutubeVideo): { text: string; wasSanitized: boolean } {
  const title = sanitizeExternalText(video.title);
  return {
    text: `Le dio like a "${title.text}" (canal ${video.channelTitle}).`,
    wasSanitized: title.wasModified,
  };
}

function toSignal(video: YoutubeVideo): { signal: ExternalSignal; wasSanitized: boolean } {
  const described = describeVideo(video);
  return {
    signal: { source: "youtube", content: described.text, occurredAt: video.publishedAt },
    wasSanitized: described.wasSanitized,
  };
}

/**
 * Adaptador `YoutubeSnapshot → ExternalSignal[]` -- mismo rol exacto
 * que `buildCalendarSignals`. `null` (sin YouTube conectado) produce
 * `[]`, nunca una señal inventada.
 */
export function buildYoutubeSignals(
  snapshot: YoutubeSnapshot | null,
): { signals: ExternalSignal[]; sanitizedCount: number } {
  if (!snapshot) {
    return { signals: [], sanitizedCount: 0 };
  }

  const results = snapshot.likedVideos.map(toSignal);

  return {
    signals: results.map((result) => result.signal),
    sanitizedCount: results.filter((result) => result.wasSanitized).length,
  };
}
