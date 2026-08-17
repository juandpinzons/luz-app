import type { YoutubeVideo } from "./youtube-video";

/**
 * La vista canónica de YouTube que el resto de LUZ consume -- único
 * punto de contacto entre YouTube Foundation y cualquier feature de
 * producto, mismo rol que `EmailSnapshot`/`CalendarSnapshot`.
 *
 * Un solo campo de señal (`likedVideos`) a propósito -- a diferencia de
 * Gmail (cinco señales derivadas de la misma bandeja: nuevo/no
 * leído/importante/esperando respuesta/hilo reciente), YouTube solo
 * expone UN recurso real y estable vía API (`videos.list(myRating=like)`,
 * ver docblock de `youtube-client.ts`) -- no hay nada más de qué derivar
 * señales adicionales sin inventar datos que la API no da.
 */
export interface YoutubeSnapshot {
  readonly generatedAt: Date;
  /** Orden `publishedAt` descendente -- como mucho `YOUTUBE_SYNC_HARD_CEILING` (`./youtube-sync-options.ts`). */
  readonly likedVideos: readonly YoutubeVideo[];
}
