import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Rate limiting genérico por clave (Auditoría de seguridad, 2026-08-21)
 * -- separada de `events` (`events.ts`) a propósito: `reserveRateLimitSlot`
 * cuenta intentos por `userId` (siempre hay sesión). Los endpoints de
 * login (`apple-auth/callback`, `mobile-auth/*`) corren ANTES de que
 * exista una sesión -- la única clave disponible es la IP, y esta tabla
 * modela eso sin forzar `events.userId` a volverse nullable-por-diseño
 * para un caso que no es "un usuario hizo algo", sino "alguien sin
 * identidad todavía tocó un endpoint sensible".
 *
 * `key` nunca guarda la IP en texto plano -- llega ya hasheada
 * (`core/security/rate-limit.ts::hashRateLimitKey`) para no retener un
 * identificador de red legible en una tabla operacional, mismo espíritu
 * de privacidad que `recordQuery` (nunca el texto de la query) y
 * `crisis_signal_detected` (nunca el contenido del mensaje).
 */
export const rateLimitEvents = pgTable(
  "rate_limit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    route: text("route").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("rate_limit_events_key_created_at_idx").on(table.key, table.createdAt),
  ],
);

export type RateLimitEvent = typeof rateLimitEvents.$inferSelect;
export type NewRateLimitEvent = typeof rateLimitEvents.$inferInsert;
