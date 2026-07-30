import type { EntityId } from "../../../core/life/value-objects/entity-id";
import type {
  CalendarConnection,
  CalendarEvent,
  CalendarSyncCursor,
  CalendarSyncOptions,
} from "../domain";
import type { ExternalEventId } from "../domain/identifiers";
import type { CalendarProvider } from "../providers";

/** Techo de seguridad contra un `CalendarProvider` mal implementado que devolviera `hasMore: true` indefinidamente -- nunca debería alcanzarse con un proveedor correcto (ningún calendario real pagina cientos de miles de veces), existe solo para que un bug de un proveedor concreto se vea como un error explícito, nunca como un loop colgado. */
const DEFAULT_MAX_PAGES = 500;

/**
 * Resultado agregado de sincronizar UNA conexión hasta agotar todas
 * sus páginas (`CalendarSyncResult.hasMore`) -- a diferencia de
 * `CalendarSyncResult`, que es el resultado de una sola llamada al
 * proveedor, esto es "toda la sincronización de esta vez", listo para
 * que una fase futura lo persista (esa persistencia NO es
 * responsabilidad de esta función -- ver README, "qué queda fuera de
 * esta fase").
 */
export interface CalendarSyncRunResult {
  readonly connectionId: EntityId;
  /** El cursor a persistir para la próxima sincronización -- siempre el más reciente devuelto por el proveedor, sin importar cuántas páginas hizo falta. */
  readonly cursor: CalendarSyncCursor;
  readonly upserted: readonly CalendarEvent[];
  readonly deleted: readonly ExternalEventId[];
  readonly pageCount: number;
  readonly syncedAt: Date;
}

/**
 * Flujo de sincronización propuesto para esta fase (ver README,
 * "Sync flow"): pagina `CalendarProvider.sync()` hasta que
 * `hasMore` sea `false`, acumulando `upserted`/`deleted` de cada
 * página y quedándose siempre con el cursor MÁS RECIENTE. Agnóstica
 * al proveedor concreto -- solo depende de la interfaz
 * `CalendarProvider`, nunca de una implementación real, por lo que es
 * genuinamente ejecutable y probable hoy (con un `CalendarProvider` de
 * prueba) sin que exista todavía ningún proveedor real.
 *
 * No persiste nada, no crea ninguna `CalendarConnection` nueva, no
 * decide qué hacer con `deleted` más allá de devolverlos -- esta
 * función es orquestación pura sobre el puerto, nunca el lugar donde
 * vive esa lógica (deliberado, ver README).
 */
export async function runCalendarSync(
  provider: CalendarProvider,
  connection: CalendarConnection,
  previousCursor: CalendarSyncCursor | null,
  options?: CalendarSyncOptions,
  maxPages: number = DEFAULT_MAX_PAGES,
): Promise<CalendarSyncRunResult> {
  const upserted: CalendarEvent[] = [];
  const deleted: ExternalEventId[] = [];

  let cursor = previousCursor;
  let pageCount = 0;
  let hasMore = true;
  let syncedAt = new Date();

  while (hasMore) {
    if (pageCount >= maxPages) {
      throw new Error(
        `runCalendarSync: se superó el límite de ${maxPages} páginas para la conexión ${connection.id} (proveedor "${provider.kind}") -- probable bug del proveedor devolviendo hasMore indefinidamente.`,
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
      `runCalendarSync: el proveedor "${provider.kind}" nunca devolvió un cursor para la conexión ${connection.id} -- contrato de CalendarProvider.sync() violado (cursor es obligatorio en cada CalendarSyncResult).`,
    );
  }

  return {
    connectionId: connection.id,
    cursor,
    upserted,
    deleted,
    pageCount,
    syncedAt,
  };
}
