import type {
  CalendarConnection,
  CalendarEvent,
  CalendarSnapshot,
  CalendarSyncCursor,
  CalendarSyncOptions,
} from "../domain";
import type { CalendarProvider } from "../providers";
import { applySyncResult } from "./apply-sync-result";
import { type CalendarSnapshotOptions, getCalendarSnapshot } from "./get-calendar-snapshot";
import { synchronizeCalendar } from "./synchronize-calendar";

export interface RefreshCalendarResult {
  readonly connection: CalendarConnection;
  readonly cursor: CalendarSyncCursor;
  /** Estado completo de eventos DESPUÉS de fusionar el delta -- no solo lo que cambió en esta corrida (eso es responsabilidad de `synchronizeCalendar` si un llamador solo necesita el delta). */
  readonly events: readonly CalendarEvent[];
  readonly snapshot: CalendarSnapshot;
}

/**
 * "Dame lo último, haciendo lo que haga falta" en una sola llamada --
 * compone `synchronizeCalendar` (habla con el proveedor) +
 * `applySyncResult` (fusiona el delta contra lo ya conocido) +
 * `getCalendarSnapshot` (deriva la vista de producto), en ese orden.
 * Pensado para un llamador interactivo ("refrescar mi calendario
 * ahora"); un job de fondo que solo quiere sincronizar sin pagar el
 * costo de recalcular el snapshot cada vez debería usar
 * `synchronizeCalendar` directamente.
 */
export async function refreshCalendar(
  provider: CalendarProvider,
  connection: CalendarConnection,
  previousCursor: CalendarSyncCursor | null,
  priorEvents: readonly CalendarEvent[],
  syncOptions?: CalendarSyncOptions,
  snapshotOptions?: CalendarSnapshotOptions,
): Promise<RefreshCalendarResult> {
  const syncResult = await synchronizeCalendar(provider, connection, previousCursor, syncOptions);
  const events = applySyncResult(priorEvents, syncResult.upserted, syncResult.deleted);
  const snapshot = getCalendarSnapshot(events, syncResult.connection, snapshotOptions);

  return {
    connection: syncResult.connection,
    cursor: syncResult.cursor,
    events,
    snapshot,
  };
}
