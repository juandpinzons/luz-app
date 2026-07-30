import type { CalendarConnection } from "../domain";

/**
 * Desconectar es una transición de estado propia de LUZ, no una
 * operación del proveedor -- CalDAV/Google/Outlook no tienen ningún
 * concepto de "desconectar" que llamar; la persona simplemente deja de
 * usarse su credencial. Nunca borra la conexión (mismo principio que
 * `CalendarConnectionStatus`, `../domain/calendar-connection.ts`: se
 * conserva la fila para no perder el historial de qué estuvo
 * conectado) -- función pura, sin I/O, el llamador decide qué hacer
 * con el resultado (incluida la credencial real, que este cimiento
 * nunca ve).
 */
export function disconnectCalendar(connection: CalendarConnection): CalendarConnection {
  return {
    ...connection,
    status: "disconnected",
    updatedAt: new Date(),
  };
}
