import type { YoutubeConnection, YoutubeProviderKind, YoutubeVideo } from "../domain";

/**
 * El canal de YouTube de esta cuenta -- doble rol que
 * `EmailLabelDescriptor`/`CalendarDescriptor`: informa qué existe Y
 * sirve como la llamada de validación de `connectYoutube()`.
 */
export interface YoutubeChannelDescriptor {
  readonly id: string;
  readonly title: string;
}

/**
 * El único contrato que cada proveedor concreto de video (`YoutubeProvider`
 * de `./youtube/`) implementa -- nombrado por el dominio (`Video`), no
 * por el proveedor, mismo criterio exacto que `EmailProvider`/
 * `CalendarProvider`: nada fuera de una implementación concreta debe
 * importar un SDK, hacer una llamada HTTP, o saber que YouTube existe.
 * Deliberadamente SIN credenciales en ninguna firma.
 *
 * **Sin `cursor` ni `sync()` incremental** -- a diferencia de
 * `EmailProvider`/`CalendarProvider`, YouTube Data API no expone ningún
 * mecanismo de "solo lo que cambió desde X" para videos que le gustan a
 * una cuenta (no hay equivalente a la Change History API de Gmail).
 * Forzar una firma con cursor aquí sería una abstracción sin
 * proveedor real que la necesite -- `fetchLikedVideos()` siempre es una
 * lectura completa de los últimos `YOUTUBE_SYNC_HARD_CEILING`
 * (`../domain/youtube-sync-options.ts`), nunca una página incremental.
 */
export interface VideoProvider {
  readonly kind: YoutubeProviderKind;

  getChannel(connection: YoutubeConnection): Promise<YoutubeChannelDescriptor>;

  /** Los últimos videos que le dio like la cuenta, orden `publishedAt` descendente, acotados a `YOUTUBE_SYNC_HARD_CEILING`. */
  fetchLikedVideos(connection: YoutubeConnection): Promise<readonly YoutubeVideo[]>;
}
