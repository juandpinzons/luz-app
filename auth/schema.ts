import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "../core/db/schema/users";

/**
 * Tablas exigidas por Auth.js (@auth/drizzle-adapter) para persistir
 * cuentas vinculadas, sesiones de base de datos y tokens de
 * verificación.
 *
 * Viven en `auth/` (Identity Layer) y NO en `core/db/schema`, a
 * propósito: su forma la dicta el mecanismo de autenticación (Auth.js),
 * no el dominio. `core/db/schema/users.ts` sigue siendo la única fuente
 * de verdad sobre la identidad del usuario — estas tablas solo la
 * referencian mediante `userId`. El dominio nunca necesita saber que
 * estas tablas existen.
 *
 * El diseño es multi-proveedor por construcción: la clave primaria de
 * `accounts` es (provider, providerAccountId), así que añadir un
 * proveedor nuevo (GitHub, email, etc. — ver auth/providers) no
 * requiere ningún cambio de esquema, solo una fila más por cuenta
 * vinculada a un mismo usuario.
 */
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index("accounts_user_id_idx").on(table.userId),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;
