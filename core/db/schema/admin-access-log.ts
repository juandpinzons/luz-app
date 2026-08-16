import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Bitácora inmutable de acceso administrativo a contenido de un
 * usuario (ADR-0024, Decisión 3 -- break-glass). Una fila por cada
 * vez que `/admin/users/[id]` (o cualquier superficie admin futura que
 * lea contenido descifrado de una persona) se visita con éxito.
 *
 * A propósito SIN `references()` hacia `users` -- ni `adminUserId` ni
 * `viewedUserId` participan de ningún FK, así que esta tabla queda
 * completamente desacoplada de cualquier cascada de borrado de cuenta:
 * el historial de acceso de un admin no es dato personal del usuario
 * visto, para borrar a su pedido (ADR-0024 lo dice explícitamente).
 * `app/api/account/delete/route.ts` / `delete-account.ts` no necesitan
 * (ni deben) tocar esta tabla.
 *
 * Solo INSERT desde el código de aplicación -- ningún UPDATE/DELETE
 * expuesto, "inmutable" no es solo un adjetivo en el docblock.
 */
export const adminAccessLog = pgTable(
  "admin_access_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id").notNull(),
    adminEmail: text("admin_email").notNull(),
    viewedUserId: uuid("viewed_user_id").notNull(),
    justification: text("justification").notNull(),
    route: text("route").notNull(),
    accessedAt: timestamp("accessed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("admin_access_log_viewed_user_id_idx").on(table.viewedUserId),
    index("admin_access_log_admin_user_id_idx").on(table.adminUserId),
    index("admin_access_log_accessed_at_idx").on(table.accessedAt),
  ],
);

export type AdminAccessLogRow = typeof adminAccessLog.$inferSelect;
export type NewAdminAccessLogRow = typeof adminAccessLog.$inferInsert;
