import type { EmailConnection, EmailMessage, EmailSyncCursor, EmailSyncOptions } from "../domain";
import type { ExternalMessageId } from "../domain/identifiers";
import type { EmailProvider } from "../providers";
import { runEmailSync } from "./run-gmail-sync";

export interface SynchronizeGmailResult {
  readonly connection: EmailConnection;
  readonly cursor: EmailSyncCursor;
  readonly upserted: readonly EmailMessage[];
  readonly deleted: readonly ExternalMessageId[];
}

/**
 * Caso de uso público de sincronización -- envuelve `runEmailSync`
 * (paginación agnóstica de proveedor) y le suma la actualización de
 * estado de la conexión. Mismo contrato, misma ausencia deliberada de
 * `try/catch`, que `synchronizeCalendar` (`./synchronize-calendar.ts`):
 * un fallo del proveedor se propaga tal cual, nunca se traduce en un
 * `EmailConnection` con `status: "error"` disfrazado de éxito. Decidir
 * qué significa un fallo concreto (p. ej. `GmailAuthExpiredError` ->
 * `needs_reauth`) es responsabilidad de quien llama.
 */
export async function synchronizeGmail(
  provider: EmailProvider,
  connection: EmailConnection,
  previousCursor: EmailSyncCursor | null,
  options?: EmailSyncOptions,
): Promise<SynchronizeGmailResult> {
  const result = await runEmailSync(provider, connection, previousCursor, options);

  return {
    connection: { ...connection, status: "active", updatedAt: result.syncedAt },
    cursor: result.cursor,
    upserted: result.upserted,
    deleted: result.deleted,
  };
}
