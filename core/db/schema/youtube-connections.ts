import { pgTable, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { YoutubeConnectionStatus, YoutubeProviderKind } from "../../youtube-connections/domain";
import { lifeGraphs } from "./life-graph";

/**
 * Persistencia real de `YoutubeConnection` (`core/youtube-connections/domain/`)
 * -- mismo patrón exacto que `email-connections.ts`/`calendar-connections.ts`.
 *
 * `encryptedCredentials` guarda `YoutubeCredentials`
 * (`accessToken`/`refreshToken`/`expiresAt`/`clientId`/`clientSecret`)
 * serializado a JSON y cifrado con `core/security/secret-cipher.ts`
 * (AES-256-GCM, misma clave que Calendar/Gmail -- el cifrado ya es
 * genérico, no específico de un proveedor). Nullable a propósito, mismo
 * criterio de seguridad que las otras dos tablas: desconectar borra el
 * secreto en reposo, no solo cambia `status`.
 *
 * Único índice compuesto (`lifeGraphId`, `providerKind`): una persona
 * puede tener a lo sumo una conexión activa por proveedor -- reconectar
 * el mismo proveedor reemplaza la fila anterior, nunca acumula filas
 * huérfanas.
 */
export const youtubeConnections = pgTable(
  "youtube_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references((): AnyPgColumn => lifeGraphs.id, { onDelete: "cascade" }),
    providerKind: text("provider_kind").notNull().$type<YoutubeProviderKind>(),
    externalAccountId: text("external_account_id").notNull(),
    encryptedCredentials: text("encrypted_credentials"),
    status: text("status").notNull().$type<YoutubeConnectionStatus>().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("youtube_connections_life_graph_provider_idx").on(table.lifeGraphId, table.providerKind),
  ],
);

export type YoutubeConnectionRow = typeof youtubeConnections.$inferSelect;
export type NewYoutubeConnectionRow = typeof youtubeConnections.$inferInsert;
