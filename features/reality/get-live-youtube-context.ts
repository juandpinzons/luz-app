import type { EntityId } from "../../core/life/value-objects/entity-id";
import type { Database } from "../../core/db/client";
import { YoutubeAuthExpiredError, YoutubeClient, YoutubeProvider } from "./providers/youtube";
import type { YoutubeSnapshot } from "./domain";
import {
  getStoredYoutubeConnection,
  markYoutubeConnectionError,
  markYoutubeConnectionNeedsReauth,
  markYoutubeConnectionSynced,
} from "../../core/youtube-connections/repository";

/**
 * Único lugar que sabe hacer "conexión guardada -> lectura en vivo ->
 * `YoutubeSnapshot`" -- mismo rol exacto que `get-live-email-context.ts`.
 * Vive en `features/reality/`, no en `core/youtube-connections/`, mismo
 * motivo: construye `YoutubeClient`/`YoutubeProvider` y llama la API
 * real, así que no puede ser una capa de persistencia pura.
 *
 * Nunca lanza -- cada estado real es un valor devuelto.
 *
 * Sin `cursor` -- a diferencia de Gmail, no hay una versión
 * "incremental" de esto que tenga sentido (ver docblock de
 * `../providers/video-provider.ts`): cada carga es `fetchLikedVideos()`
 * completo, acotado a `YOUTUBE_SYNC_HARD_CEILING` por diseño, así que
 * repetirlo en cada carga es seguro y determinista, mismo espíritu que
 * la justificación de Gmail para `cursor: null` en cada llamada.
 */

export type LiveYoutubeOutcome =
  | { status: "not_connected" }
  | { status: "connected"; externalAccountId: string; snapshot: YoutubeSnapshot }
  | { status: "needs_reauth"; externalAccountId: string }
  | { status: "error"; externalAccountId: string; error: unknown };

export async function getLiveYoutubeContext(db: Database, lifeGraphId: EntityId): Promise<LiveYoutubeOutcome> {
  const stored = await getStoredYoutubeConnection(db, lifeGraphId, "youtube");

  if (!stored || stored.connection.status === "disconnected" || !stored.credentials) {
    return { status: "not_connected" };
  }

  const client = new YoutubeClient(stored.credentials);
  const provider = new YoutubeProvider(client);

  try {
    const likedVideos = await provider.fetchLikedVideos(stored.connection);

    await markYoutubeConnectionSynced(db, stored.connection.id, client.getCurrentCredentials());

    return {
      status: "connected",
      externalAccountId: stored.connection.externalAccountId,
      snapshot: { generatedAt: new Date(), likedVideos },
    };
  } catch (error) {
    if (error instanceof YoutubeAuthExpiredError) {
      await markYoutubeConnectionNeedsReauth(db, stored.connection.id);
      return { status: "needs_reauth", externalAccountId: stored.connection.externalAccountId };
    }

    await markYoutubeConnectionError(db, stored.connection.id);
    return { status: "error", externalAccountId: stored.connection.externalAccountId, error };
  }
}
