import { pgTable, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { CalendarConnectionStatus, CalendarProviderKind } from "../../calendar-connections/domain";
import { lifeGraphs } from "./life-graph";

/**
 * Persistencia real de `CalendarConnection` (`features/reality/domain/`)
 * -- Calendar Foundation define la forma pero deliberadamente no
 * persiste nada (ver `features/reality/README.md`, "Nada de esto
 * persiste nada" y "Puntos de extensión #2"). Esta es esa capa
 * siguiente, tal como ese README la anticipó.
 *
 * `encryptedCredentials` guarda `AppleCalendarCredentials`
 * (`appleId`+`appSpecificPassword`) serializado a JSON y cifrado con
 * `core/security/secret-cipher.ts` (AES-256-GCM) -- nunca en texto
 * plano. La contraseña específica de app de Apple hace falta en cada
 * sincronización (CalDAV usa Basic Auth, no OAuth), así que a
 * diferencia de un hash de contraseña, este secreto debe poder leerse
 * de vuelta, no solo compararse.
 *
 * Único índice compuesto (`lifeGraphId`, `providerKind`): una persona
 * puede tener a lo sumo una conexión activa por proveedor -- conectar
 * de nuevo el mismo proveedor reemplaza la fila anterior (mismo
 * `externalAccountId` o uno distinto), nunca acumula filas huérfanas.
 */
export const calendarConnections = pgTable(
  "calendar_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references((): AnyPgColumn => lifeGraphs.id, { onDelete: "cascade" }),
    providerKind: text("provider_kind").notNull().$type<CalendarProviderKind>(),
    externalAccountId: text("external_account_id").notNull(),
    /**
     * Cifrado -- ver docblock de arriba. Nunca leer/loguear esta
     * columna directo, siempre a través de
     * `core/calendar-connections/repository.ts`. Nullable a propósito
     * (auditoría de seguridad, 2026-08-14): `disconnectStoredCalendarConnection`
     * la limpia -- desconectar debe borrar el secreto en reposo, no
     * solo cambiar `status`.
     */
    encryptedCredentials: text("encrypted_credentials"),
    status: text("status").notNull().$type<CalendarConnectionStatus>().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("calendar_connections_life_graph_provider_idx").on(table.lifeGraphId, table.providerKind),
  ],
);

export type CalendarConnectionRow = typeof calendarConnections.$inferSelect;
export type NewCalendarConnectionRow = typeof calendarConnections.$inferInsert;
