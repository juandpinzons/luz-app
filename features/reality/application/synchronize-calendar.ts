import type {
  CalendarConnection,
  CalendarEvent,
  CalendarSyncCursor,
  CalendarSyncOptions,
} from "../domain";
import type { ExternalEventId } from "../domain/identifiers";
import type { CalendarProvider } from "../providers";
import { runCalendarSync } from "./run-calendar-sync";

export interface SynchronizeCalendarResult {
  /** `status`/`updatedAt` reflejan una sincronización exitosa -- ver docblock. */
  readonly connection: CalendarConnection;
  readonly cursor: CalendarSyncCursor;
  readonly upserted: readonly CalendarEvent[];
  readonly deleted: readonly ExternalEventId[];
}

/**
 * Caso de uso público de sincronización -- envuelve `runCalendarSync`
 * (paginación agnóstica de proveedor, ya existente) y le suma la
 * actualización de estado de la conexión que un consumidor de
 * producto necesita, sin que ninguno de los dos conozca al otro más
 * de lo necesario.
 *
 * Sin `try/catch` a propósito: un fallo del proveedor se propaga tal
 * cual, nunca se traduce en un `CalendarConnection` con
 * `status: "error"` disfrazado de éxito. Este caso de uso tampoco
 * inspecciona qué tipo de error lanzó el proveedor (p. ej. no conoce
 * `CalDavInvalidSyncTokenError`, específico de Apple) -- decidir qué
 * significa un fallo concreto (reautenticar, reintentar, marcar
 * `needs_reauth`) es responsabilidad de quien llama, con el
 * conocimiento de negocio que este caso de uso deliberadamente no
 * tiene (Fase 4: ningún detalle de proveedor cruza esta frontera).
 */
export async function synchronizeCalendar(
  provider: CalendarProvider,
  connection: CalendarConnection,
  previousCursor: CalendarSyncCursor | null,
  options?: CalendarSyncOptions,
): Promise<SynchronizeCalendarResult> {
  const result = await runCalendarSync(provider, connection, previousCursor, options);

  return {
    connection: { ...connection, status: "active", updatedAt: result.syncedAt },
    cursor: result.cursor,
    upserted: result.upserted,
    deleted: result.deleted,
  };
}
