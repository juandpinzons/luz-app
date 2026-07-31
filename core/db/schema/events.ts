import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Eventos operacionales (Sprint de Observabilidad, Alpha) — únicamente
 * lo que ninguna tabla de dominio ya captura. `conversations` y
 * `conversation_messages` ya son el registro de uso real; esta tabla
 * no los duplica. Solo dos tipos hoy: login y error inesperado — el
 * catálogo crece agregando valores al enum, nunca con una columna
 * `metadata` de propósito genérico como sustituto de modelado real.
 */
export const eventTypeEnum = pgEnum("event_type", [
  "auth_sign_in",
  "error",
  "message_attempted",
  "message_sent",
  /**
   * Misión "Experience Intelligence V1" -- una fila por cada vez que
   * Home decide cuál `ExperienceCard` mostrar como primaria.
   * `metadata.key`/`metadata.category` (ver `features/experience/`)
   * es lo único que la rotación necesita leer de vuelta: qué tarjeta
   * exacta ganó, ordenado por `createdAt`, filtrado por
   * `events_user_type_created_at_idx` (mismo índice que ya usa
   * `reserveRateLimitSlot`). Ninguna tabla nueva: es exactamente el
   * tipo de "señal operacional que ninguna tabla de dominio ya
   * captura" que esta tabla ya existe para modelar.
   */
  "experience_card_shown",
]);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: eventTypeEnum("type").notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    route: text("route"),
    message: text("message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("events_type_idx").on(table.type),
    index("events_created_at_idx").on(table.createdAt),
    /**
     * `reserveRateLimitSlot` (`features/chat/services/check-rate-limit.ts`)
     * filtra exactamente por estas tres columnas en CADA mensaje enviado
     * -- sin este índice compuesto, esa consulta hace Seq Scan sobre toda
     * la tabla (confirmado con EXPLAIN ANALYZE, auditoría Staff Engineer
     * 2026-07-28: barato hoy con pocas filas, pero `events` no tiene
     * retención/poda y crece sin límite -- ese Seq Scan corre dentro de
     * la transacción que sostiene el advisory lock por usuario, así que
     * su costo se vuelve latencia real en el camino crítico de cada
     * mensaje a medida que la tabla crece).
     */
    index("events_user_type_created_at_idx").on(
      table.userId,
      table.type,
      table.createdAt,
    ),
  ],
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
