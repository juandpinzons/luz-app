import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { users } from "../db/schema/users";
import { lifeGraphs } from "../db/schema/life-graph";
import { accountIdentities } from "../../auth/schema";

/**
 * Borra una cuenta y TODO lo que le pertenece, de verdad -- no un
 * "soft delete", no una desactivación. Mismo patrón exacto que ya usa
 * `smoke/utils/test-account.ts` (`resetTestAccount`) para dejar la
 * cuenta fixture en blanco, solo que aquí el paso final es borrar
 * `users` en vez de recrearlo.
 *
 * Orden importa: `life_graphs` no tiene FK hacia `users` (se resuelve
 * vía `account_identities`, ver `auth/schema.ts`) -- borrar `users`
 * primero dejaría el LifeGraph completo (memorias, creencias,
 * conceptos, conexiones de Gmail/Calendar/Garmin...) huérfano, sin
 * nada que lo alcance. Encontrar el LifeGraph vía `account_identities`
 * y borrarlo PRIMERO es lo único que lo captura -- después, borrar
 * `users` cascada el resto (conversaciones, eventos, feedback,
 * knowledge jobs, sesiones, accounts de OAuth).
 *
 * Transacción: si el proceso muere entre los dos borrados, sin esto
 * quedaría una fila de `users` reactivable con su LifeGraph ya
 * borrado -- inconsistente con "la cuenta ya no existe".
 */
export async function deleteAccount(db: Database, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [identity] = await tx
      .select({ lifeGraphId: accountIdentities.lifeGraphId })
      .from(accountIdentities)
      .where(eq(accountIdentities.accountId, userId));

    if (identity) {
      await tx.delete(lifeGraphs).where(eq(lifeGraphs.id, identity.lifeGraphId));
    }

    await tx.delete(users).where(eq(users.id, userId));
  });
}
