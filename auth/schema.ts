import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { lifeGraphs, persons } from "../core/db/schema/life-graph";
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

/**
 * Vínculo entre una Account y el LifeGraphContext que le pertenece
 * (ADR-0011). Vive en `auth/`, no en `core/db/schema/life-graph.ts`:
 * el dominio nunca debe conocer `AccountId` (ver auth/account-id.ts),
 * así que esta tabla —la única que sabe de los dos lados— vive junto a
 * `accounts`/`sessions`, no dentro del schema del dominio. Una Account
 * se resuelve a exactamente un LifeGraph, creado una sola vez en el
 * primer login (auth/drizzle-identity-resolver.ts).
 */
export const accountIdentities = pgTable("account_identities", {
  accountId: uuid("account_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  lifeGraphId: uuid("life_graph_id")
    .notNull()
    .references(() => lifeGraphs.id, { onDelete: "cascade" }),
  personId: uuid("person_id")
    .notNull()
    .references(() => persons.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AccountIdentity = typeof accountIdentities.$inferSelect;
export type NewAccountIdentity = typeof accountIdentities.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;
