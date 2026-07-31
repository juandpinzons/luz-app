import { EMAIL_SYNC_HARD_CEILING, type EmailMessage } from "../domain";
import type { ExternalMessageId } from "../domain/identifiers";

/**
 * `EmailProvider.sync()` (y por lo tanto `synchronizeGmail()`) solo
 * devuelve un DELTA -- mismo principio que `applySyncResult`
 * (`./apply-sync-result.ts`): upsert por `id`, después quita los
 * borrados, delete siempre gana si el mismo id aparece en ambos
 * conjuntos.
 *
 * **Diferencia real con Calendar**: después de fusionar, este cimiento
 * SIEMPRE recorta el resultado a `EMAIL_SYNC_HARD_CEILING`
 * (`../domain/email-sync-options.ts`), quedándose con los más
 * recientes por `receivedAt` -- la política de "nunca más de 10
 * mensajes conocidos" (misión: "Do NOT store complete mailboxes") solo
 * puede hacerse cumplir AQUÍ, no en el proveedor: `GmailProvider.sync()`
 * (`../providers/gmail/gmail-provider.ts`) acota lo que devuelve EN UNA
 * llamada, pero nunca ve `priorMessages` -- solo esta función tiene
 * visibilidad sobre el estado acumulado completo (previo + delta) para
 * decidir cuáles 10 sobreviven.
 */
export function applyEmailSyncResult(
  priorMessages: readonly EmailMessage[],
  upserted: readonly EmailMessage[],
  deleted: readonly ExternalMessageId[],
): EmailMessage[] {
  const byId = new Map(priorMessages.map((message) => [message.id, message]));

  for (const message of upserted) {
    byId.set(message.id, message);
  }
  for (const id of deleted) {
    byId.delete(id);
  }

  const merged = [...byId.values()].sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
  return merged.slice(0, EMAIL_SYNC_HARD_CEILING);
}
