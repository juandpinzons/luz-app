import type { EmailConnection, EmailMessage, EmailSnapshot, EmailSyncCursor, EmailSyncOptions } from "../domain";
import type { EmailProvider } from "../providers";
import { applyEmailSyncResult } from "./apply-email-sync-result";
import { type EmailSnapshotOptions, getEmailSnapshot } from "./get-email-snapshot";
import { synchronizeGmail } from "./synchronize-gmail";

export interface RefreshGmailResult {
  readonly connection: EmailConnection;
  readonly cursor: EmailSyncCursor;
  /** Estado completo de mensajes DESPUÉS de fusionar el delta y aplicar el techo de 10 -- ver `apply-email-sync-result.ts`. */
  readonly messages: readonly EmailMessage[];
  readonly snapshot: EmailSnapshot;
}

/**
 * "Dame lo último, haciendo lo que haga falta" en una sola llamada --
 * compone `synchronizeGmail` + `applyEmailSyncResult` +
 * `getEmailSnapshot`, en ese orden. Mismo rol que `refreshCalendar`
 * (`./refresh-calendar.ts`): pensado para un llamador interactivo; un
 * job de fondo que solo quiere sincronizar sin pagar el costo de
 * recalcular el snapshot cada vez debería usar `synchronizeGmail`
 * directamente.
 */
export async function refreshGmail(
  provider: EmailProvider,
  connection: EmailConnection,
  previousCursor: EmailSyncCursor | null,
  priorMessages: readonly EmailMessage[],
  syncOptions?: EmailSyncOptions,
  snapshotOptions?: EmailSnapshotOptions,
): Promise<RefreshGmailResult> {
  const syncResult = await synchronizeGmail(provider, connection, previousCursor, syncOptions);
  const messages = applyEmailSyncResult(priorMessages, syncResult.upserted, syncResult.deleted);
  const snapshot = getEmailSnapshot(messages, syncResult.connection, snapshotOptions);

  return {
    connection: syncResult.connection,
    cursor: syncResult.cursor,
    messages,
    snapshot,
  };
}
