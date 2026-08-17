import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { wearableConsents } from "../db/schema/wearable";
import type { EntityId } from "../life/value-objects/entity-id";
import type { WearableProviderKind } from "./domain";

/**
 * Consentimiento real antes de compartir datos de wearable (auditoría
 * de privacidad, 2026-08-17) -- ver docblock de `wearableConsents`
 * (`core/db/schema/wearable.ts`). `recordConsent` es upsert por diseño
 * (`onConflictDoNothing`): consentir dos veces no es un error, la
 * primera fecha real es la que importa.
 */
export async function hasWearableConsent(
  db: Database,
  lifeGraphId: EntityId,
  provider: WearableProviderKind,
): Promise<boolean> {
  const [row] = await db
    .select({ id: wearableConsents.id })
    .from(wearableConsents)
    .where(
      and(
        eq(wearableConsents.lifeGraphId, lifeGraphId),
        eq(wearableConsents.provider, provider),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function recordWearableConsent(
  db: Database,
  lifeGraphId: EntityId,
  provider: WearableProviderKind,
): Promise<void> {
  await db
    .insert(wearableConsents)
    .values({ lifeGraphId, provider })
    .onConflictDoNothing({
      target: [wearableConsents.lifeGraphId, wearableConsents.provider],
    });
}
