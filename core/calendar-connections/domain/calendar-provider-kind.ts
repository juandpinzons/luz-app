/**
 * Los tres proveedores que este cimiento está diseñado para soportar
 * (Calendar Phase I) -- Apple, Google, Outlook. Agregar un cuarto
 * proveedor mañana es sumar un literal aquí + una clase nueva que
 * implemente `CalendarProvider` (`../providers/calendar-provider`);
 * ningún contrato de este módulo cambia de forma por eso.
 *
 * Unión cerrada a propósito, no un `string` suelto: cada consumidor
 * (UI, lógica de reconexión, logging) puede hacer `switch` exhaustivo
 * sobre esto sin adivinar valores posibles.
 */
export const CALENDAR_PROVIDER_KINDS = ["apple", "google", "outlook"] as const;

export type CalendarProviderKind = (typeof CALENDAR_PROVIDER_KINDS)[number];
