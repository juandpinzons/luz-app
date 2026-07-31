import type { EntityId } from "../../../core/life/value-objects/entity-id";
import type { EmailConnection, EmailMessage, EmailSyncCursor, EmailSyncOptions } from "../domain";
import type { ExternalMessageId } from "../domain/identifiers";
import type { EmailProvider } from "../providers";

/** Mismo techo de seguridad que `DEFAULT_MAX_PAGES` en `run-calendar-sync.ts`, misma razón: nunca debería alcanzarse con un `EmailProvider` correcto, existe solo para que un bug de paginación se vea como un error explícito, nunca un loop colgado. */
const DEFAULT_MAX_PAGES = 500;

export interface EmailSyncRunResult {
  readonly connectionId: EntityId;
  /** El cursor a persistir para la próxima sincronización -- siempre el más reciente devuelto por el proveedor. */
  readonly cursor: EmailSyncCursor;
  readonly upserted: readonly EmailMessage[];
  readonly deleted: readonly ExternalMessageId[];
  readonly pageCount: number;
  readonly syncedAt: Date;
}

/**
 * Pagina `EmailProvider.sync()` hasta que `hasMore` sea `false`,
 * acumulando `upserted`/`deleted` y quedándose con el cursor MÁS
 * RECIENTE -- mismo flujo, mismas garantías, que `runCalendarSync`
 * (`./run-calendar-sync.ts`). Agnóstica al proveedor concreto, solo
 * depende del puerto `EmailProvider`.
 */
export async function runEmailSync(
  provider: EmailProvider,
  connection: EmailConnection,
  previousCursor: EmailSyncCursor | null,
  options?: EmailSyncOptions,
  maxPages: number = DEFAULT_MAX_PAGES,
): Promise<EmailSyncRunResult> {
  const upserted: EmailMessage[] = [];
  const deleted: ExternalMessageId[] = [];

  let cursor = previousCursor;
  let pageCount = 0;
  let hasMore = true;
  let syncedAt = new Date();

  while (hasMore) {
    if (pageCount >= maxPages) {
      throw new Error(
        `runEmailSync: se superó el límite de ${maxPages} páginas para la conexión ${connection.id} (proveedor "${provider.kind}") -- probable bug del proveedor devolviendo hasMore indefinidamente.`,
      );
    }

    const result = await provider.sync(connection, cursor, options);

    upserted.push(...result.upserted);
    deleted.push(...result.deleted);
    cursor = result.cursor;
    hasMore = result.hasMore;
    syncedAt = result.syncedAt;
    pageCount += 1;
  }

  if (!cursor) {
    throw new Error(
      `runEmailSync: el proveedor "${provider.kind}" nunca devolvió un cursor para la conexión ${connection.id} -- contrato de EmailProvider.sync() violado.`,
    );
  }

  return { connectionId: connection.id, cursor, upserted, deleted, pageCount, syncedAt };
}
