import type { CalendarEvent } from "../domain";
import type { ExternalEventId } from "../domain/identifiers";

/**
 * `CalendarProvider.sync()` (y por lo tanto `synchronizeCalendar()`)
 * solo devuelve un DELTA -- eventos creados/modificados y ids
 * borrados, nunca el estado completo del calendario (ver docblock de
 * `CalendarSyncResult`, `../domain`). Sin una capa de persistencia
 * (no existe en este cimiento), fusionar ese delta contra lo que el
 * llamador ya tenía es trabajo real que cada consumidor necesitaría
 * reinventar -- esta función lo hace una sola vez, pura, sin I/O:
 * upsert por `id`, después quita los borrados. El orden importa si
 * (caso límite, no debería pasar con un proveedor correcto) el mismo
 * id aparece en `upserted` Y en `deleted` -- gana el borrado, nunca al
 * revés, porque un id borrado ya no debe existir sin importar en qué
 * orden llegó la información.
 */
export function applySyncResult(
  priorEvents: readonly CalendarEvent[],
  upserted: readonly CalendarEvent[],
  deleted: readonly ExternalEventId[],
): CalendarEvent[] {
  const byId = new Map(priorEvents.map((event) => [event.id, event]));

  for (const event of upserted) {
    byId.set(event.id, event);
  }
  for (const id of deleted) {
    byId.delete(id);
  }

  return [...byId.values()];
}
