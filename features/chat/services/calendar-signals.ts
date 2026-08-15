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
/**
 * `wasModified` es la señal real de "esto tenía algo que colapsar/
 * acotar" -- la base del conteo `calendar_signal_sanitized` (tablero de
 * salud diario, 2026-08-14) que un operador humano puede vigilar sin
 * que esta función deje de ser pura (sigue sin tocar `db`/logging --
 * quien la llama, `get-calendar-signals-for-conversation.ts`, decide
 * si registra el evento).
 */
function sanitizeExternalText(value: string): { text: string; wasModified: boolean } {
  // `wasModified` marca solo las dos señales que de verdad importan
  // (saltos de línea/control, o largo excesivo) -- un simple espacio
  // sobrante al final de un título real (`.trim()`) no cuenta como
  // sospechoso, sería puro ruido en el conteo del tablero de salud.
  const hadControlChars = /[\r\n\t]/.test(value);
  const collapsed = value.replace(/[\r\n\t]+/g, " ").trim();
  const wasTruncated = collapsed.length > MAX_EXTERNAL_TEXT_LENGTH;
  const text = wasTruncated ? `${collapsed.slice(0, MAX_EXTERNAL_TEXT_LENGTH)}…` : collapsed;
  return { text, wasModified: hadControlChars || wasTruncated };
}

/**
 * Una frase natural por evento, nunca datos crudos -- el modelo lee
 * esto tal cual dentro de la sección "signal" del prompt (ver
 * `favor-prioritized-context-rule.ts`), así que debe leerse como algo
 * que una persona diría, no como un registro de calendario. La
 * ubicación se incluye solo si el proveedor la trajo -- nunca
 * inventada.
 */
function describeEvent(event: CalendarEvent, isToday: boolean): { text: string; wasSanitized: boolean } {
  const title = sanitizeExternalText(event.title);
  const location = event.location ? sanitizeExternalText(event.location) : null;
  const wasSanitized = title.wasModified || (location?.wasModified ?? false);
  const locationSuffix = location ? ` en ${location.text}` : "";

  if (event.timing.isAllDay) {
    const when = isToday ? "Hoy" : `El ${DATE_FORMAT.format(eventStart(event))}`;
    return { text: `${when} es "${title.text}"${locationSuffix} (todo el día).`, wasSanitized };
  }

  const start = eventStart(event);
  const end = eventEnd(event);
  const timeRange = `${TIME_FORMAT.format(start)} a ${TIME_FORMAT.format(end)}`;
  const when = isToday ? "Hoy tiene" : `El ${DATE_FORMAT.format(start)} tiene`;

  return { text: `${when} "${title.text}"${locationSuffix} de ${timeRange}.`, wasSanitized };
}

function toSignal(event: CalendarEvent, isToday: boolean): { signal: ExternalSignal; wasSanitized: boolean } {
  const start = eventStart(event);
  const described = describeEvent(event, isToday);
  return {
    signal: { source: "calendar", content: described.text, occurredAt: start, dueDate: start },
    wasSanitized: described.wasSanitized,
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
 *
 * `sanitizedCount` (auditoría de seguridad, 2026-08-14): cuántos
 * eventos de este lote tenían un título/ubicación con saltos de línea
 * o largo excesivo -- la señal más simple de un intento real de
 * inyección de prompt. Quien llama con acceso a `db`
 * (`get-calendar-signals-for-conversation.ts`) decide si registra el
 * evento operacional; esta función se queda pura.
 */
export function buildCalendarSignals(
  calendar: HomeCalendarContext | null,
): { signals: ExternalSignal[]; sanitizedCount: number } {
  if (!calendar) {
    return { signals: [], sanitizedCount: 0 };
  }

  const results = [
    ...calendar.today.map((event) => toSignal(event, true)),
    ...calendar.upcomingEvents.map((event) => toSignal(event, false)),
  ];

  return {
    signals: results.map((result) => result.signal),
    sanitizedCount: results.filter((result) => result.wasSanitized).length,
  };
}
