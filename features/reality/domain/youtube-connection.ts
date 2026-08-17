/** Mismo patrón que `email-connection.ts`: re-export de `core/youtube-connections/domain` (core/ no puede importar de features/). */
export type { YoutubeConnection, YoutubeConnectionStatus } from "../../../core/youtube-connections/domain";
export { YOUTUBE_CONNECTION_STATUSES } from "../../../core/youtube-connections/domain";
