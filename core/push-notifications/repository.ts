import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { devicePushTokens, type DevicePushTokenRow } from "../db/schema/push-notifications";
import type { DevicePushPlatform, PushEnvironment } from "./domain";

/**
 * Registra (o reemplaza, si el mismo `deviceToken` ya existía -- p. ej.
 * el dispositivo cambió de dueño, o la app se reinstaló) un token de
 * push real. Se llama tras el login y en cada arranque en frío (Apple
 * puede rotar el token en silencio, ver `app/api/push/register/route.ts`).
 */
export async function registerDevicePushToken(
  db: Database,
  userId: string,
  deviceToken: string,
  platform: DevicePushPlatform,
  environment: PushEnvironment,
): Promise<void> {
  const now = new Date();

  await db
    .insert(devicePushTokens)
    .values({ userId, deviceToken, platform, environment, createdAt: now, updatedAt: now, lastSeenAt: now })
    .onConflictDoUpdate({
      target: devicePushTokens.deviceToken,
      set: { userId, platform, environment, updatedAt: now, lastSeenAt: now },
    });
}

/**
 * Borrado real, nunca una transición de estado -- ver docblock de
 * `devicePushTokens` en `core/db/schema/push-notifications.ts` para el
 * porqué. Se llama tanto en logout (`app/api/push/unregister/route.ts`)
 * como cuando APNs señala que un token ya no sirve
 * (`core/push-notifications/send-push-notification.ts`).
 *
 * Escopado por `userId` a propósito -- sin esto, cualquier sesión
 * autenticada podría borrar el token de OTRA persona con solo conocer
 * su valor (un token de dispositivo es difícil de adivinar, pero
 * "difícil de adivinar" no es lo mismo que "el modelo de autorización
 * correcto"). Ambos llamadores ya tienen el `userId` correcto a mano.
 */
export async function deleteDevicePushToken(db: Database, userId: string, deviceToken: string): Promise<void> {
  await db
    .delete(devicePushTokens)
    .where(and(eq(devicePushTokens.userId, userId), eq(devicePushTokens.deviceToken, deviceToken)));
}

export async function listDevicePushTokensForUser(db: Database, userId: string): Promise<DevicePushTokenRow[]> {
  return db.select().from(devicePushTokens).where(eq(devicePushTokens.userId, userId));
}
