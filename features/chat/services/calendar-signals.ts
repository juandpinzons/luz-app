import type { ExternalSignal } from "../../../core/reality";
import type { HomeCalendarContext } from "../../home/domain/home-state";
import type { CalendarEvent } from "../../reality/domain";

/**
 * Pura a propósito -- sin esta separación, cualquier import de
 * `buildCalendarSignals` (incluyendo el script de ejemplo standalone)
 * arrastraría `getLiveCalendarContext`
 * (`get-calendar-signals-for-conversation.ts`) y, con él, la
 * validación de variables de entorno (`core/config/env.ts`), rompiendo
 * la posibilidad de probar esto sin una base de datos real. Mismo
 * criterio de separación que ya existe entre
 * `features/home/services/build-calendar-context.ts` (puro) y
 * `core/calendar-connections/get-live-calendar-context.ts` (I/O real).
 */

/**
 * Mismo criterio de lectura que ya usa
 * `features/home/services/build-calendar-context.ts` (`eventStart`/
 * `eventEnd`): se repite aquí porque no hay forma de importarlo sin
 * tocar ese módulo, pero es la lectura de una forma PÚBLICA de
 * dominio (`CalendarEvent.timing`), no una regla de negocio de
 * Calendar Foundation.
 */
function eventStart(event: CalendarEvent): Date {
  return event.timing.isAllDay ? new Date(`${event.timing.date}T00:00:00Z`) : event.timing.dateTime;
}

function eventEnd(event: CalendarEvent): Date {
  return event.timing.isAllDay ? new Date(`${event.timing.endDate}T00:00:00Z`) : event.timing.endDateTime;
}

const TIME_ZONE = "America/Bogota";

const TIME_FORMAT = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TIME_ZONE,
});

const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: TIME_ZONE,
});

const MAX_EXTERNAL_TEXT_LENGTH = 200;

/**
 * `event.title`/`event.location` los escribe quien envía la invitación
 * -- nunca la persona dueña de LUZ ni LUZ misma (auditoría de
 * seguridad, 2026-08-14: cualquiera que le mande una invitación de
 * calendario controla este texto). Sin este paso llegarían tal cual al
 * mensaje `system` del prompt (ver `render-context.ts`), el mismo
 * bloque donde vive Conversation Strategy/Voice -- un título escrito
 * para parecer una instrucción tendría, ahí, la misma autoridad que
 * una instrucción real. Colapsa saltos de línea/control (la forma más
 * simple de simular una línea nueva "de sistema") y acota el largo --
 * mitigación razonable, no una garantía: ningún filtro de texto plano
 * es 100% robusto contra inyección de prompt, por eso
 * `SOURCE_GUIDANCE.signal` (`favor-prioritized-context-rule.ts`)
 * también instruye al modelo explícitamente a tratar esto como dato,
 * nunca como instrucción -- las dos capas juntas, no una sola.
 */
function sanitizeExternalText(value: string): string {
  const collapsed = value.replace(/[\r\n\t]+/g, " ").trim();
  return collapsed.length > MAX_EXTERNAL_TEXT_LENGTH
    ? `${collapsed.slice(0, MAX_EXTERNAL_TEXT_LENGTH)}…`
    : collapsed;
}

/**
 * Una frase natural por evento, nunca datos crudos -- el modelo lee
 * esto tal cual dentro de la sección "signal" del prompt (ver
 * `favor-prioritized-context-rule.ts`), así que debe leerse como algo
 * que una persona diría, no como un registro de calendario. La
 * ubicación se incluye solo si el proveedor la trajo -- nunca
 * inventada.
 */
function describeEvent(event: CalendarEvent, isToday: boolean): string {
  const title = sanitizeExternalText(event.title);
  const location = event.location ? ` en ${sanitizeExternalText(event.location)}` : "";

  if (event.timing.isAllDay) {
    const when = isToday ? "Hoy" : `El ${DATE_FORMAT.format(eventStart(event))}`;
    return `${when} es "${title}"${location} (todo el día).`;
  }

  const start = eventStart(event);
  const end = eventEnd(event);
  const timeRange = `${TIME_FORMAT.format(start)} a ${TIME_FORMAT.format(end)}`;
  const when = isToday ? "Hoy tiene" : `El ${DATE_FORMAT.format(start)} tiene`;

  return `${when} "${title}"${location} de ${timeRange}.`;
}

function toSignal(event: CalendarEvent, isToday: boolean): ExternalSignal {
  const start = eventStart(event);
  return {
    source: "calendar",
    content: describeEvent(event, isToday),
    occurredAt: start,
    dueDate: start,
  };
}

/**
 * Adaptador `CalendarSnapshot → ExternalSignal[]` -- el punto de
 * extensión que `features/reality/README.md` (punto #4) y el docblock
 * de `CalendarEvent` ya documentaban como pendiente ("un adaptador...
 * no existe todavía"). Vive en `features/chat/`, nunca en
 * `core/reality` ni en `features/reality`: es la traducción hacia UN
 * consumidor puntual (la conversación), no una regla de negocio de
 * Calendar Foundation -- misma frontera que ya traza `toLifeStateItem`
 * en `assemble-reality-snapshot.ts` para Goals/Projects/Habits.
 *
 * `calendar.upcomingEvents` ya excluye lo que está en `calendar.today`
 * (`build-calendar-context.ts`, `excludeToday`) -- nunca se repite la
 * exclusión aquí. `null` (sin calendario conectado) produce `[]`,
 * nunca una señal inventada.
 */
export function buildCalendarSignals(calendar: HomeCalendarContext | null): ExternalSignal[] {
  if (!calendar) {
    return [];
  }

  return [
    ...calendar.today.map((event) => toSignal(event, true)),
    ...calendar.upcomingEvents.map((event) => toSignal(event, false)),
  ];
}
