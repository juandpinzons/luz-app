import { YOUTUBE_SYNC_HARD_CEILING, type YoutubeConnection, type YoutubeProviderKind, type YoutubeVideo } from "../../domain";
import type { VideoProvider, YoutubeChannelDescriptor } from "../video-provider";
import { YoutubeClient } from "./youtube-client";
import { mapYoutubeVideosToDomain } from "./youtube-mapper";

/**
 * Confirma que las credenciales inyectadas de verdad pertenecen a la
 * cuenta que esta `YoutubeConnection` dice representar -- mismo control
 * de aislamiento defensivo que `assertAccountMatches` en
 * `gmail-provider.ts`.
 */
function assertAccountMatches(connection: YoutubeConnection, authenticatedChannelId: string): void {
  if (connection.externalAccountId !== authenticatedChannelId) {
    throw new Error(
      `YoutubeProvider: la cuenta autenticada ("${authenticatedChannelId}") no coincide con externalAccountId de la conexión ${connection.id} ("${connection.externalAccountId}") -- sync abortado para evitar sincronizar la cuenta equivocada.`,
    );
  }
}

/**
 * Implementación de `YoutubeProvider` (`../youtube-provider`) sobre
 * YouTube Data API v3. Mismo reparto de responsabilidad que
 * `GmailProvider`: esta clase decide QUÉ hacer con los datos del
 * cliente (el techo de 10 videos, el orden); `YoutubeClient` decide
 * CÓMO hablar con YouTube.
 */
export class YoutubeProvider implements VideoProvider {
  readonly kind: YoutubeProviderKind = "youtube";

  constructor(private readonly client: YoutubeClient) {}

  async getChannel(connection: YoutubeConnection): Promise<YoutubeChannelDescriptor> {
    void connection; // El cliente ya está autenticado contra una única cuenta -- mismo criterio que GmailProvider.listLabels().
    return this.client.getChannel();
  }

  async fetchLikedVideos(connection: YoutubeConnection): Promise<readonly YoutubeVideo[]> {
    const channel = await this.client.getChannel();
    assertAccountMatches(connection, channel.id);

    const page = await this.client.listLikedVideos(YOUTUBE_SYNC_HARD_CEILING);
    const videos = mapYoutubeVideosToDomain(page.items);

    return [...videos].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }
}
