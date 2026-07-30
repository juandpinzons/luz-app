import type { EntityId } from "../../../core/life/value-objects/entity-id";
import type { CalendarEvent } from "./calendar-event";
import type { CalendarSyncCursor } from "./calendar-sync-cursor";
import type { ExternalEventId } from "./identifiers";

/**
 * Resultado de UNA llamada a `CalendarProvider.sync()` -- un delta, no
 * un snapshot completo del calendario. `upserted` cubre creación Y
 * modificación a la vez (un evento editado sigue siendo el mismo id,
 * `lastModifiedAt` más reciente) porque ningún proveedor objetivo
 * distingue "nuevo" de "editado" en su respuesta de sincronización de
 * forma confiable -- quien persista esto decide con un upsert por
 * `id`, no con dos rutas separadas.
 *
 * `deleted` son ids, nunca `CalendarEvent[]` completos -- un evento
 * borrado no tiene contenido que devolver, un proveedor de
 * sincronización incremental típicamente solo confirma que el id ya
 * no existe (o pasó a `status: "cancelled"`, ver `CalendarEvent`,
 * según qué exponga cada proveedor).
 *
 * `cursor` es SIEMPRE el nuevo cursor a persistir para la próxima
 * sincronización, incluso cuando `hasMore` es `true` -- cada página
 * de un sync incremental avanza el cursor, un fallo a mitad de
 * paginación no debe forzar repetir desde el principio.
 */
export interface CalendarSyncResult {
  readonly connectionId: EntityId;
  readonly cursor: CalendarSyncCursor;
  readonly upserted: readonly CalendarEvent[];
  readonly deleted: readonly ExternalEventId[];
  /** `true` si el proveedor tiene más resultados de ESTA misma pasada de sincronización -- el llamador vuelve a invocar `sync()` con `cursor` para continuar. */
  readonly hasMore: boolean;
  readonly syncedAt: Date;
}
