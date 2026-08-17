import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * MFA real para `/admin` (auditoría de privacidad, 2026-08-17) --
 * `isAdmin()` era solo un allowlist de email, sin segundo factor.
 * `encryptedSecret` cifrado con `content-cipher.ts` (mismo estándar
 * que el resto de contenido sensible, ADR-0024) -- un secreto TOTP en
 * texto plano en la base sería tan malo como cualquier otro secreto
 * que ya protegimos.
 *
 * `verifiedAt` distingue "generé un secreto pero nunca confirmé con un
 * código real" de "ya lo verifiqué de verdad" -- el gate
 * (`requireAdminMfa`) solo confía en credenciales verificadas. Un solo
 * secreto por admin (PK = `adminUserId`) -- reenrolar sobrescribe el
 * anterior, a propósito: no hay flujo de "múltiples dispositivos" en
 * esta primera versión.
 *
 * Recuperación si se pierde el dispositivo: dado que hoy solo hay un
 * admin real (o muy pocos), la recuperación es borrar la fila
 * directamente en la base (acceso que ya requiere las mismas
 * credenciales de infraestructura que cualquier otra operación de
 * emergencia) -- no se construyen códigos de respaldo en esta pasada,
 * documentado como decisión, no como olvido.
 */
export const adminTotpCredentials = pgTable("admin_totp_credentials", {
  adminUserId: uuid("admin_user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  encryptedSecret: text("encrypted_secret").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminTotpCredentialRow = typeof adminTotpCredentials.$inferSelect;
export type NewAdminTotpCredentialRow = typeof adminTotpCredentials.$inferInsert;
