import { type EntityId, createEntityId } from "../../../core/life/value-objects/entity-id";
import type { YoutubeConnection } from "../domain";
import type { VideoProvider } from "../providers";

export interface ConnectYoutubeInput {
  readonly lifeGraphId: EntityId;
  /** El id del canal de YouTube de la cuenta -- opaco para este caso de uso, solo se guarda. Mismo criterio que `ConnectGmailInput.externalAccountId`. */
  readonly externalAccountId: string;
}

/**
 * "Conectar" significa poder hablar de verdad con el proveedor, no solo
 * construir un objeto -- `provider.getChannel()` se llama una vez para
 * validar; unas credenciales inválidas fallan aquí, nunca en silencio
 * en el primer `fetchLikedVideos()` más adelante. Mismo contrato que
 * `connectGmail` (`./connect-gmail.ts`).
 */
export async function connectYoutube(provider: VideoProvider, input: ConnectYoutubeInput): Promise<YoutubeConnection> {
  const now = new Date();

  const connection: YoutubeConnection = {
    id: createEntityId(crypto.randomUUID()),
    lifeGraphId: input.lifeGraphId,
    providerKind: provider.kind,
    externalAccountId: input.externalAccountId,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  await provider.getChannel(connection);

  return connection;
}
