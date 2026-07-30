import type { ExternalCalendarId } from "./identifiers";

/**
 * Un calendario disponible dentro de una `CalendarConnection` -- una
 * cuenta casi siempre expone más de uno (personal, trabajo,
 * compartido, feriados). `CalendarProvider.listCalendars()` devuelve
 * estos; quien decide cuáles sincronizar (todos, uno, una selección)
 * es una decisión de aplicación futura, no de este contrato.
 */
export interface CalendarDescriptor {
  readonly id: ExternalCalendarId;
  readonly displayName: string;
  /** El calendario por defecto de la cuenta -- útil como preselección, nunca una obligación de sincronizar solo ese. */
  readonly isPrimary: boolean;
  /** Un calendario de solo lectura (p. ej. "Feriados de Colombia") no puede recibir escrituras futuras -- lo que sí se lea de él sigue siendo válido. */
  readonly isWritable: boolean;
  readonly color?: string;
}
