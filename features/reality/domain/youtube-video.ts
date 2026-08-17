import type { ExternalVideoId } from "./identifiers";

/**
 * Representación neutral de un video de YouTube que le gustó a la
 * persona -- mismo principio de frontera que `EmailMessage`: el resto
 * de LUZ nunca debe saber que esto vino de la API de YouTube
 * específicamente.
 *
 * **Deliberadamente sin `description`** -- mismo criterio de alcance
 * mínimo que `EmailMessage` (sin cuerpo del mensaje): la API de YouTube
 * expone `snippet.description` completa, pero LUZ no la necesita para
 * el propósito real (una señal de interés/estado de ánimo, no un
 * archivo de qué vio la persona) y cada campo de texto libre adicional
 * es más superficie para un intento de inyección de prompt vía un
 * título/descripción escrito por un tercero (el creador del video,
 * nunca la persona ni LUZ) -- ver `sanitizeExternalText` en
 * `features/chat/services/youtube-signals.ts`.
 *
 * **Sin `likedAt`** -- la API de YouTube (`videos.list(myRating=like)`)
 * no expone cuándo se le dio like a un video, solo `publishedAt` (la
 * fecha en que el CREADOR lo publicó). No se aproxima ni se inventa.
 */
export interface YoutubeVideo {
  readonly id: ExternalVideoId;
  readonly title: string;
  readonly channelId: string;
  readonly channelTitle: string;
  readonly publishedAt: Date;
  readonly thumbnailUrl?: string;
  readonly url: string;
}
