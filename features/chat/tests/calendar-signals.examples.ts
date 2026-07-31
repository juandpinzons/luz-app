import { createExternalCalendarId, createExternalEventId } from "../../reality/domain";
import type { CalendarEvent } from "../../reality/domain";
import type { HomeCalendarContext } from "../../home/domain/home-state";
import { buildCalendarSignals } from "../services/calendar-signals";

/**
 * Script standalone con datos sintéticos, ejecutable con
 * `npx tsx features/chat/tests/calendar-signals.examples.ts` -- mismo
 * criterio que el resto de las carpetas tests/ dentro de features/ en
 * este repo (no hay framework de unit tests). Prueba únicamente `buildCalendarSignals`
 * (pura, sin red ni base de datos) -- `getCalendarSignalsForConversation`
 * (con caché + sincronización real) no se puede probar sin una cuenta
 * de calendario real.
 */

const CALENDAR_ID = createExternalCalendarId("calendar-personal");

function timedEvent(id: string, title: string, startIso: string, endIso: string, location?: string): CalendarEvent {
  return {
    id: createExternalEventId(id),
    calendarId: CALENDAR_ID,
    title,
    location,
    status: "confirmed",
    timing: {
      isAllDay: false,
      dateTime: new Date(startIso),
      timeZone: "America/Bogota",
      endDateTime: new Date(endIso),
      endTimeZone: "America/Bogota",
    },
    attendees: [],
    lastModifiedAt: new Date(startIso),
  };
}

function allDayEvent(id: string, title: string, date: string, endDate: string): CalendarEvent {
  return {
    id: createExternalEventId(id),
    calendarId: CALENDAR_ID,
    title,
    status: "confirmed",
    timing: { isAllDay: true, date, endDate },
    attendees: [],
    lastModifiedAt: new Date(`${date}T00:00:00Z`),
  };
}

function makeCalendar(today: CalendarEvent[], upcomingEvents: CalendarEvent[]): HomeCalendarContext {
  return {
    status: "up_to_date",
    today,
    upcomingEvents,
    freeBlocks: [],
    recurringCommitments: [],
    meetingMoments: [],
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

let hasFailure = false;

function runScenario(name: string, run: () => void) {
  try {
    run();
    console.log(`PASS  ${name}`);
  } catch (error) {
    hasFailure = true;
    console.log(`FAIL  ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

runScenario("sin calendario conectado -- nunca inventa una señal", () => {
  assert(buildCalendarSignals(null).length === 0, "calendar null debía producir 0 señales");
});

runScenario("evento de hoy -- frase natural, dueDate = inicio del evento", () => {
  const standup = timedEvent("standup", "Standup del equipo", "2026-07-31T09:00:00-05:00", "2026-07-31T09:30:00-05:00");
  const signals = buildCalendarSignals(makeCalendar([standup], []));

  assert(signals.length === 1, "debía producir exactamente 1 señal");
  const signal = signals[0]!;
  assert(signal.source === "calendar", 'source debía ser "calendar"');
  assert(signal.content.startsWith("Hoy tiene"), `un evento de hoy debía empezar con "Hoy tiene", llegó: "${signal.content}"`);
  assert(signal.content.includes("Standup del equipo"), "debía incluir el título real del evento");
  assert(signal.content.includes("9:00") && signal.content.includes("9:30"), "debía incluir la hora de inicio y fin");
  assert(!standup.timing.isAllDay && signal.dueDate?.getTime() === standup.timing.dateTime.getTime(), "dueDate debía ser el inicio real del evento");
});

runScenario("evento futuro (no hoy) -- usa fecha, no 'Hoy'", () => {
  const planning = timedEvent("planning", "Planning Q3", "2026-08-05T09:00:00-05:00", "2026-08-05T10:00:00-05:00");
  const signals = buildCalendarSignals(makeCalendar([], [planning]));

  assert(signals.length === 1, "debía producir exactamente 1 señal");
  assert(!signals[0]!.content.startsWith("Hoy"), `un evento futuro no debía decir "Hoy", llegó: "${signals[0]!.content}"`);
  assert(signals[0]!.content.includes("Planning Q3"), "debía incluir el título real del evento");
});

runScenario("ubicación real se incluye, nunca inventada", () => {
  const withLocation = timedEvent("con-ubicacion", "Cena", "2026-07-31T19:00:00-05:00", "2026-07-31T21:00:00-05:00", "Restaurante La Central");
  const withoutLocation = timedEvent("sin-ubicacion", "Llamada", "2026-07-31T10:00:00-05:00", "2026-07-31T10:30:00-05:00");
  const signals = buildCalendarSignals(makeCalendar([withLocation, withoutLocation], []));

  assert(signals[0]!.content.includes("en Restaurante La Central"), "debía incluir la ubicación real cuando existe");
  assert(!signals[1]!.content.includes(" en "), "no debía inventar una ubicación cuando el evento no trae ninguna");
});

runScenario("evento de todo el día -- sin horas, marcado como tal", () => {
  const holiday = allDayEvent("feriado", "Día festivo", "2026-08-07", "2026-08-08");
  const signals = buildCalendarSignals(makeCalendar([], [holiday]));

  assert(signals[0]!.content.includes("todo el día"), "debía marcar el evento como de todo el día");
  assert(!signals[0]!.content.includes(":"), "un evento de todo el día no debía incluir una hora inventada");
});

runScenario("today + upcoming se combinan, sin duplicar la exclusión que ya hace HomeCalendarContext", () => {
  const todayEvent = timedEvent("hoy-1", "Evento de hoy", "2026-07-31T14:00:00-05:00", "2026-07-31T15:00:00-05:00");
  const upcomingEvent = timedEvent("prox-1", "Evento futuro", "2026-08-01T14:00:00-05:00", "2026-08-01T15:00:00-05:00");
  const signals = buildCalendarSignals(makeCalendar([todayEvent], [upcomingEvent]));

  assert(signals.length === 2, "debía combinar today + upcomingEvents (2 señales)");
});

if (hasFailure) {
  process.exit(1);
}
