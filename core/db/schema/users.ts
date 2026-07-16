import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Identidad del usuario. Forma compatible con el adapter de Postgres de
 * Auth.js para que la autenticación (pendiente, ver decisión de
 * arquitectura #9) se pueda conectar sin migrar esta tabla.
 *
 * `metadata` es el único lugar permitido para datos flexibles (ej.
 * preferencias sueltas que no ameritan una tabla propia) — nunca se usa
 * como sustituto de un modelo Entity-Attribute-Value.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
