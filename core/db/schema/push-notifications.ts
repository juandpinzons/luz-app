import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { DevicePushPlatform, PushEnvironment } from "../../push-notifications/domain";
import { users } from "./users";

/**
 * Un token de dispositivo APNs por fila -- keyed por `userId` (lo que
 * `getUserContext()` ya resuelve directo, ver `app/api/push/register/route.ts`),
 * no por `lifeGraphId`: los disparadores que ya corren en cron
 * (`app/api/cron/continuity-worker/route.ts`, knowledge-worker) resuelven
 * `lifeGraphId` -> `userId` cuando hace falta vía el mismo
 * `AccountIdentityResolver` que usa el resto del dominio, no hace
 * falta duplicar la columna aquí.
 *
 * A diferencia de `calendar_connections`/`email_connections`/
 * `youtube_connections`, esta tabla SÍ borra filas de verdad
 * (`deleteDevicePushToken`, `core/push-notifications/repository.ts`) --
 * un token de push obsoleto no tiene valor de auditoría, y dejarlo
 * arriesga que APNs marque la app por reintentar contra tokens
 * inválidos repetidamente.
 */
export const devicePushTokens = pgTable(
  "device_push_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceToken: text("device_token").notNull(),
    platform: text("platform").notNull().$type<DevicePushPlatform>(),
    environment: text("environment").notNull().$type<PushEnvironment>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("device_push_tokens_token_idx").on(table.deviceToken)],
);

export type DevicePushTokenRow = typeof devicePushTokens.$inferSelect;
export type NewDevicePushTokenRow = typeof devicePushTokens.$inferInsert;
