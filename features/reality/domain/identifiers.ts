declare const externalEventIdBrand: unique symbol;
declare const externalCalendarIdBrand: unique symbol;

/**
 * El id que el proveedor externo le da a un evento (Google `event.id`,
 * el `UID` de un `VEVENT` de Apple/EventKit, el `id` de Microsoft
 * Graph). Nunca un `EntityId` (`core/life`) -- no es un uuid nuestro,
 * es opaco y su formato varía por proveedor. Marcado con un símbolo
 * único, mismo criterio que `EntityId`, para que TypeScript no permita
 * mezclarlo con un `ExternalCalendarId` o cualquier otro string por
 * accidente.
 */
export type ExternalEventId = string & { readonly [externalEventIdBrand]: true };

export function createExternalEventId(value: string): ExternalEventId {
  if (!value) {
    throw new Error("ExternalEventId: el valor no puede estar vacío.");
  }
  return value as ExternalEventId;
}

/**
 * El id que el proveedor externo le da a UN CALENDARIO dentro de una
 * cuenta (una persona casi siempre tiene más de uno: personal,
 * trabajo, compartido). Mismo criterio que `ExternalEventId`: opaco,
 * nunca un `EntityId`.
 */
export type ExternalCalendarId = string & { readonly [externalCalendarIdBrand]: true };

export function createExternalCalendarId(value: string): ExternalCalendarId {
  if (!value) {
    throw new Error("ExternalCalendarId: el valor no puede estar vacío.");
  }
  return value as ExternalCalendarId;
}
