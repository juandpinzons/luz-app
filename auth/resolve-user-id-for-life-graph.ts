import { eq } from "drizzle-orm";
import type { Database } from "../core/db/client";
import type { EntityId } from "../core/life/value-objects/entity-id";
import { accountIdentities } from "./schema";

/**
 * Dirección inversa de `DrizzleAccountIdentityResolver.resolve()`
 * (`accountId -> LifeGraphContext`) -- misión "shell nativo iOS",
 * 2026-08-18: los disparadores de push (`app/api/cron/continuity-worker/route.ts`,
 * knowledge-worker) razonan sobre `LifeGraphContext`, pero
 * `sendPushNotification` necesita `userId` (lo que
 * `device_push_tokens` guarda, ver `core/db/schema/push-notifications.ts`).
 * `accountId` en `account_identities` YA ES el `userId` (referencia
 * `users.id`) -- esto solo lee esa misma tabla en la otra dirección,
 * nunca duplica el vínculo.
 */
export async function resolveUserIdForLifeGraph(db: Database, lifeGraphId: EntityId): Promise<string | null> {
  const [row] = await db
    .select({ accountId: accountIdentities.accountId })
    .from(accountIdentities)
    .where(eq(accountIdentities.lifeGraphId, lifeGraphId))
    .limit(1);

  return row?.accountId ?? null;
}
