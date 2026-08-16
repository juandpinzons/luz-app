import type { EntityId } from "../../core/life/value-objects/entity-id";
import type { Database } from "../../core/db/client";
import { refreshGmail } from "./application";
import { GmailAuthExpiredError, GmailClient, GmailProvider } from "./providers/gmail";
import type { EmailSnapshot } from "./domain";
import {
  getStoredEmailConnection,
  markEmailConnectionError,
  markEmailConnectionNeedsReauth,
  markEmailConnectionSynced,
} from "../../core/email-connections/repository";

/**
 * Único lugar que sabe hacer "conexión guardada -> sync en vivo ->
 * `EmailSnapshot`" -- mismo rol que
 * `features/home/services/get-live-calendar-context.ts`, para que
 * `/gmail` (y cualquier futura pantalla que quiera correo, p. ej.
 * `/dashboard`) nunca puedan divergir en ese criterio.
 *
 * Vive en `features/reality/`, no en `core/email-connections/`
 * (auditoría de arquitectura, 2026-08-15): construye `GmailClient`/
 * `GmailProvider` y llama `refreshGmail` directamente, así que no puede
 * ser una capa de persistencia pura -- `core/email-connections/repository.ts`
 * sigue siendo esa capa, esta función la consume, nunca al revés.
 *
 * Nunca lanza -- cada estado real (sin conectar / sincronizado /
 * necesita reautorizar / error) es un valor devuelto, mismo criterio
 * de tolerancia a fallos que Calendar.
 *
 * `cursor: null` en cada llamada, a propósito -- mismo punto de partida
 * que Calendar Foundation eligió en su fase 1 (ver
 * `features/home/services/get-live-calendar-context.ts`): sin una capa
 * de persistencia de `EmailSyncCursor` todavía, cada carga hace un
 * `syncInitial` completo. A diferencia de calendario, esto es seguro
 * por diseño para Gmail -- `EMAIL_SYNC_HARD_CEILING = 10`
 * (`features/reality/domain/email-sync-options.ts`) hace que un
 * `syncInitial` repetido sea barato y determinista, nunca una
 * sincronización creciente sin límite. Persistir el cursor entre
 * cargas (sync incremental real) queda documentado como extensión, no
 * como pendiente urgente -- mismo criterio que ese README ya aplica en
 * otros puntos.
 */

export type LiveEmailOutcome =
  | { status: "not_connected" }
  | { status: "connected"; externalAccountId: string; snapshot: EmailSnapshot }
  | { status: "needs_reauth"; externalAccountId: string }
  | { status: "error"; externalAccountId: string; error: unknown };

export async function getLiveEmailContext(db: Database, lifeGraphId: EntityId): Promise<LiveEmailOutcome> {
  const stored = await getStoredEmailConnection(db, lifeGraphId, "gmail");

  // La segunda condición es redundante en el camino feliz (una conexión
  // `disconnected` siempre tiene `credentials: null`, ver
  // `disconnectStoredEmailConnection`) -- se deja explícita para que
  // TypeScript angoste `stored.credentials` a no-null de aquí en
  // adelante, sin un cast.
  if (!stored || stored.connection.status === "disconnected" || !stored.credentials) {
    return { status: "not_connected" };
  }

  const client = new GmailClient(stored.credentials);
  const provider = new GmailProvider(client);

  try {
    const { snapshot, connection } = await refreshGmail(provider, stored.connection, null, []);

    // `GmailClient` pudo haber refrescado `accessToken` en memoria durante la llamada -- ver docblock de `markEmailConnectionSynced`.
    await markEmailConnectionSynced(db, connection.id, client.getCurrentCredentials());

    return { status: "connected", externalAccountId: connection.externalAccountId, snapshot };
  } catch (error) {
    if (error instanceof GmailAuthExpiredError) {
      await markEmailConnectionNeedsReauth(db, stored.connection.id);
      return { status: "needs_reauth", externalAccountId: stored.connection.externalAccountId };
    }

    await markEmailConnectionError(db, stored.connection.id);
    return { status: "error", externalAccountId: stored.connection.externalAccountId, error };
  }
}
