import type { CalendarEvent, CalendarSnapshot } from "../../reality/domain";
import type { HomeCalendarContext, HomeMeetingMoment, HomeMeetingMomentKind } from "../domain/home-state";

/**
 * Mismo desenvolvimiento de dos líneas que ya hace
 * `features/reality/application/calendar-timing-helpers.ts`
 * (`eventStart`/`eventEnd`, no exportado desde `features/reality/` --
 * ver `application/index.ts`) -- se repite aquí porque no hay forma de
 * importarlo sin tocar ese módulo, pero es la lectura de una forma
 * PÚBLICA de dominio (`CalendarEvent.timing`), no una regla de negocio
 * de Calendar Foundation. Ningún cálculo de ventana/frontera de "hoy"
 * se reimplementa aquí -- eso sí sería la lógica duplicada que esta
 * misión pide evitar; esto es solo leer un campo.
 */
function eventStart(event: CalendarEvent): Date {
  return event.timing.isAllDay ? new Date(`${event.timing.date}T00:00:00Z`) : event.timing.dateTime;
}

function eventEnd(event: CalendarEvent): Date {
  return event.timing.isAllDay ? new Date(`${event.timing.endDate}T00:00:00Z`) : event.timing.endDateTime;
}

const STARTING_SOON_WINDOW_MINUTES = 30;
const RECENTLY_ENDED_WINDOW_MINUTES = 30;

function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60_000;
}

/**
 * Categoriza cada evento de `today` según su posición respecto a `now`
 * -- tres cubetas por umbral fijo, nunca una puntuación. `now` es
 * siempre `calendar.generatedAt` (mismo instante que Calendar
 * Foundation ya usó para decidir qué es "hoy"), nunca un segundo "ahora"
 * independiente calculado aquí.
 */
function buildMeetingMoments(today: readonly CalendarEvent[], now: Date): HomeMeetingMoment[] {
  const moments: HomeMeetingMoment[] = [];

  for (const event of today) {
    const start = eventStart(event);
    const end = eventEnd(event);

    let kind: HomeMeetingMomentKind | null = null;
    if (start.getTime() <= now.getTime() && now.getTime() < end.getTime()) {
      kind = "in_progress";
    } else if (now.getTime() < start.getTime() && minutesBetween(now, start) <= STARTING_SOON_WINDOW_MINUTES) {
      kind = "starting_soon";
    } else if (end.getTime() <= now.getTime() && minutesBetween(end, now) <= RECENTLY_ENDED_WINDOW_MINUTES) {
      kind = "recently_ended";
    }

    if (kind) moments.push({ kind, event });
  }

  return moments;
}

/**
 * `CalendarSnapshot.upcoming` incluye eventos de hoy (la ventana
 * empieza en `todayStart`, ver `get-calendar-snapshot.ts`) -- restar
 * por `id` lo que ya está en `today` es la única forma de que
 * "Upcoming events" no repita lo que "Busy Today" ya muestra.
 */
function excludeToday(upcoming: readonly CalendarEvent[], today: readonly CalendarEvent[]): CalendarEvent[] {
  const todayIds = new Set(today.map((event) => event.id));
  return upcoming.filter((event) => !todayIds.has(event.id));
}

/**
 * Proyecta un `CalendarSnapshot` de Calendar Foundation
 * (`features/reality/`) a `HomeCalendarContext` -- passthrough salvo
 * las dos derivaciones documentadas en `HomeCalendarContext`
 * (`upcomingEvents`, `meetingMoments`). `null` in, `null` out: la
 * persona sin calendario conectado es responsabilidad de quien llama a
 * `buildHomeState`, esta función nunca inventa un estado "no
 * conectado" a partir de datos que no tiene.
 */
export function buildCalendarContext(calendar: CalendarSnapshot | null): HomeCalendarContext | null {
  if (!calendar) return null;

  return {
    status: calendar.syncStatus.state,
    today: calendar.today,
    upcomingEvents: excludeToday(calendar.upcoming, calendar.today),
    freeBlocks: calendar.freeBlocks,
    recurringCommitments: calendar.recurringCommitments,
    meetingMoments: buildMeetingMoments(calendar.today, calendar.generatedAt),
  };
}
