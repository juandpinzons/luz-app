import { pgTable, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { EmailConnectionStatus, EmailProviderKind } from "../../../features/reality/domain";
import { lifeGraphs } from "./life-graph";

/**
 * Persistencia real de `EmailConnection` (`features/reality/domain/`)
 * -- Gmail Foundation define la forma pero deliberadamente no persiste
 * nada (ver `features/reality/README.md`, "Gmail Foundation", Puntos
 * de extensión #2). Mismo patrón exacto que `calendar-connections.ts`.
 *
 * `encryptedCredentials` guarda `GmailCredentials`
 * (`accessToken`/`refreshToken`/`expiresAt`/`clientId`/`clientSecret`)
 * serializado a JSON y cifrado con `core/security/secret-cipher.ts`
 * (AES-256-GCM, misma clave que Calendar -- el cifrado ya es genérico,
 * no específico de un proveedor). El `refreshToken` hace falta en cada
 * renovación de `accessToken`, así que a diferencia de un hash de
 * contraseña, este secreto debe poder leerse de vuelta, no solo
 * compararse.
 *
 * Único índice compuesto (`lifeGraphId`, `providerKind`): una persona
 * puede tener a lo sumo una conexión activa por proveedor -- reconectar
 * el mismo proveedor reemplaza la fila anterior, nunca acumula filas
 * huérfanas.
 */
export const emailConnections = pgTable(
  "email_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references((): AnyPgColumn => lifeGraphs.id, { onDelete: "cascade" }),
    providerKind: text("provider_kind").notNull().$type<EmailProviderKind>(),
    externalAccountId: text("external_account_id").notNull(),
    /** Cifrado -- ver docblock de arriba. Nunca leer/loguear esta columna directo, siempre a través de `core/email-connections/repository.ts`. */
    encryptedCredentials: text("encrypted_credentials").notNull(),
    status: text("status").notNull().$type<EmailConnectionStatus>().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("email_connections_life_graph_provider_idx").on(table.lifeGraphId, table.providerKind),
  ],
);

export type EmailConnectionRow = typeof emailConnections.$inferSelect;
export type NewEmailConnectionRow = typeof emailConnections.$inferInsert;
