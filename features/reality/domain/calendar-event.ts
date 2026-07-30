import type { ExternalCalendarId, ExternalEventId } from "./identifiers";

/**
 * Estado del evento en el proveedor -- "cancelled" existe porque un
 * delta sync (`CalendarProvider.sync`) representa un evento borrado
 * como una fila que SIGUE apareciendo con este status, no como una
 * ausencia silenciosa (mismo principio de "la ausencia real se
 * representa como ausencia" que ya rige `RealitySnapshot`,
 * `core/reality`). Ningún proveedor de los tres objetivo (Apple/
 * Google/Outlook) se sale de este vocabulario de tres estados.
 */
export const CALENDAR_EVENT_STATUSES = ["confirmed", "tentative", "cancelled"] as const;
export type CalendarEventStatus = (typeof CALENDAR_EVENT_STATUSES)[number];

export const CALENDAR_ATTENDEE_RESPONSE_STATUSES = [
  "needs_action",
  "accepted",
  "declined",
  "tentative",
] as const;
export type CalendarAttendeeResponseStatus =
  (typeof CALENDAR_ATTENDEE_RESPONSE_STATUSES)[number];

export interface CalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus: CalendarAttendeeResponseStatus;
  isOrganizer: boolean;
}

/**
 * Un intervalo de tiempo con o sin hora -- un evento de todo-el-día
 * (cumpleaños, feriado) no tiene hora ni zona horaria real que
 * preservar; uno con hora sí. Modelarlos con el mismo campo `Date`
 * obligaría a inventar una hora falsa (medianoche UTC) para el
 * primero, perdiendo la distinción real entre "todo el día" y "a las
 * 00:00" -- los tres proveedores objetivo distinguen esto
 * explícitamente (Google `date` vs `dateTime`, EventKit `isAllDay`,
 * Microsoft Graph `isAllDay`), así que el cimiento también debe
 * distinguirlo.
 *
 * Fin obligatorio en el mismo tipo (no un campo `end` aparte) a
 * propósito -- así es estructuralmente imposible tener un inicio
 * todo-el-día con un fin con hora, o viceversa, que nunca ocurre en
 * datos reales de calendario.
 *
 * Extensión añadida en la fase "Calendar Foundation" (Fase 2/3):
 * la Fase 1 solo modelaba el inicio -- un vacío real descubierto al
 * construir `CalendarSnapshot` (Fase 3), que necesita el fin de cada
 * evento para calcular bloques libres/ocupados; sin él, ese cálculo es
 * imposible, no solo impreciso. Cambio aditivo, mínimo, justificado
 * por ese bloqueo real -- no un rediseño del contrato.
 */
export type CalendarEventTiming =
  | {
      readonly isAllDay: true;
      readonly date: string;
      /** Exclusivo (RFC 5545 §3.6.1): el día DESPUÉS del último día real del evento -- un evento de un solo día tiene `endDate` = `date` + 1 día, nunca `endDate === date`. */
      readonly endDate: string;
    }
  | {
      readonly isAllDay: false;
      readonly dateTime: Date;
      readonly timeZone: string;
      readonly endDateTime: Date;
      /** Casi siempre igual a `timeZone` en datos reales, pero no se asume -- RFC 5545 no exige que DTSTART/DTEND compartan zona. */
      readonly endTimeZone: string;
    };

/**
 * Recurrencia expresada como regla RFC 5545 (`RRULE:...`), nunca en un
 * formato inventado por este cimiento. Es el único vocabulario de
 * recurrencia que los tres proveedores objetivo ya hablan o pueden
 * traducir sin pérdida (Google y Apple/EventKit la exponen tal cual;
 * Microsoft Graph expone su propio `recurrence.pattern`, pero es una
 * traducción mecánica 1:1 hacia RRULE, responsabilidad del futuro
 * `OutlookCalendarProvider`, no de este contrato). Un proveedor
 * concreto es quien produce esta cadena; nada en `features/reality/`
 * la interpreta ni la evalúa -- es opaca para todo lo que no sea el
 * proveedor que la generó.
 */
export interface CalendarRecurrence {
  /** P. ej. `"RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"`. */
  readonly rule: string;
  /** Presente solo si este evento es UNA instancia de una serie recurrente (una excepción editada, p. ej.) -- identifica el evento maestro. */
  readonly recurringEventId?: ExternalEventId;
}

/**
 * Representación neutral de un evento de calendario -- la forma que
 * CUALQUIER proveedor (Apple/Google/Outlook, y cualquiera que se
 * agregue después) debe poder producir sin que nada aquí asuma su
 * origen. Un futuro consumidor (p. ej. un adaptador hacia
 * `ExternalSignal`, `core/reality`) solo conoce esta forma, nunca el
 * SDK ni el formato de respuesta de ningún proveedor real.
 *
 * `raw` es la única válvula de escape a propósito: un proveedor puede
 * necesitar preservar un campo que este contrato no modela todavía
 * (p. ej. datos de videollamada, adjuntos) sin que eso obligue a
 * cambiar la forma central cada vez que un proveedor tiene un campo
 * más. Nada fuera del proveedor que lo llenó debe leer `raw` ni asumir
 * su forma -- es responsabilidad exclusiva de quien lo escribió.
 */
export interface CalendarEvent {
  readonly id: ExternalEventId;
  readonly calendarId: ExternalCalendarId;
  readonly title: string;
  readonly description?: string;
  readonly location?: string;
  readonly status: CalendarEventStatus;
  readonly timing: CalendarEventTiming;
  readonly recurrence?: CalendarRecurrence;
  readonly attendees: readonly CalendarAttendee[];
  /** Última modificación según el proveedor -- la base para resolución de conflictos futura, nunca `syncedAt` (que es cuándo LUZ lo vio, no cuándo cambió de verdad). */
  readonly lastModifiedAt: Date;
  readonly raw?: Readonly<Record<string, unknown>>;
}
