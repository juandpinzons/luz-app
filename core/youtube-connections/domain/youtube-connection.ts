import type { EntityId } from "../../life/value-objects/entity-id";
import type { YoutubeProviderKind } from "./youtube-provider-kind";

/**
 * Mismo vocabulario que `EmailConnectionStatus`
 * (`core/email-connections/domain/email-connection.ts`) -- nunca un
 * booleano `connected: boolean` que no puede distinguir "nunca se
 * conectó" de "se desconectó" de "el token expiró y hay que
 * reautorizar". Definido de forma independiente a propósito, mismo
 * criterio que el resto de este módulo de conexiones: cada unión vive
 * sola.
 */
export const YOUTUBE_CONNECTION_STATUSES = ["active", "needs_reauth", "disconnected", "error"] as const;
export type YoutubeConnectionStatus = (typeof YOUTUBE_CONNECTION_STATUSES)[number];

/**
 * Un vínculo autorizado entre un `LifeGraph` y una cuenta de YouTube.
 * Deliberadamente SIN credenciales -- mismo principio que
 * `EmailConnection`: la credencial viaja separada (ver
 * `YoutubeCredentials`), nunca mezclada en la entidad de dominio.
 */
export interface YoutubeConnection {
  readonly id: EntityId;
  readonly lifeGraphId: EntityId;
  readonly providerKind: YoutubeProviderKind;
  /** Identificador de canal/cuenta de YouTube (`channel.id`) -- opaco, nunca interpretado aquí. */
  readonly externalAccountId: string;
  readonly status: YoutubeConnectionStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
