import { createEntityId } from "../../../core/life";
import { getCalendarSnapshot } from "../../reality/application";
import {
  createExternalCalendarId,
  createExternalEventId,
  type CalendarConnection,
  type CalendarConnectionStatus,
  type CalendarEvent,
  type CalendarSnapshot,
} from "../../reality/domain";

/**
 * Fixtures propios de Calendar dentro de Home -- esta misión pide
 * trabajar solo dentro de `features/home/`, así que estos escenarios
 * no viven junto a los de `features/presence/tests/fixtures.ts`.
 * Construyen `CalendarEvent`/`CalendarConnection` sintéticos y llaman
 * a `getCalendarSnapshot` DE VERDAD (`features/reality/application`,
 * sin modificar) -- esto ejercita la función real de Calendar
 * Foundation, no una versión imaginada de su comportamiento.
 */

const CALENDAR_ID = createExternalCalendarId("calendar-personal");

function connection(status: CalendarConnectionStatus, createdAt: Date, updatedAt: Date): CalendarConnection {
  return {
    id: createEntityId("calendar-connection-1"),
    lifeGraphId: createEntityId("life-graph-1"),
    providerKind: "apple",
    externalAccountId: "persona@icloud.com",
    status,
    createdAt,
    updatedAt,
  };
}

function timedEvent(
  id: string,
  title: string,
  startIso: string,
  endIso: string,
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    id: createExternalEventId(id),
    calendarId: CALENDAR_ID,
    title,
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Busy day -- `now` elegido a propósito a media tarde en Bogotá (15:00), lejos
// de la ventana problemática (ver "boundary limitation" abajo), para que este
// escenario ejercite today/upcoming/freeBlocks/meetingMoments/recurring/dedupe
// sin quedar contaminado por la limitación de zona horaria documentada en el
// README (Fase 2 de esta misión).
// ---------------------------------------------------------------------------

const BUSY_DAY_NOW = new Date("2026-07-29T15:00:00-05:00");

export const MORNING_MEETING_ID = "event-standup-manana";
export const RECURRING_SERIES_TITLE = "1:1 semanal con el equipo";

const morningStandup = timedEvent(
  MORNING_MEETING_ID,
  "Standup del equipo",
  "2026-07-29T09:00:00-05:00",
  "2026-07-29T09:30:00-05:00",
);

const recentlyEndedMeeting = timedEvent(
  "event-review-diseno",
  "Review de diseño",
  "2026-07-29T14:15:00-05:00",
  "2026-07-29T14:45:00-05:00",
);

const inProgressMeeting = timedEvent(
  "event-1-1-daniel",
  "1:1 con Daniel",
  "2026-07-29T14:50:00-05:00",
  "2026-07-29T15:10:00-05:00",
);

const startingSoonMeeting = timedEvent(
  "event-retro-sprint",
  "Retro de sprint",
  "2026-07-29T15:15:00-05:00",
  "2026-07-29T15:45:00-05:00",
);

const tomorrowMeeting = timedEvent(
  "event-planning-q3",
  "Planning Q3",
  "2026-07-30T09:00:00-05:00",
  "2026-07-30T10:00:00-05:00",
);

/**
 * Serie recurrente cuyo único evento sincronizado es el maestro, con
 * fecha de anclaje muy en el pasado (fuera de cualquier ventana
 * today/upcoming razonable) -- el caso exacto que `RecurringCommitment`
 * existe para cubrir (Fase 1 de esta misión: sin expandir `RRULE`,
 * esta serie no puede aparecer en `today`/`upcoming`, pero sí debe
 * aparecer en `recurringCommitments`).
 */
const recurringMasterWithNoInstanceInWindow = timedEvent(
  "event-1-1-equipo-master",
  RECURRING_SERIES_TITLE,
  "2025-01-06T08:00:00-05:00",
  "2025-01-06T08:30:00-05:00",
  { recurrence: { rule: "RRULE:FREQ=WEEKLY;BYDAY=MO" } },
);

const cancelledMeeting = timedEvent(
  "event-cancelado",
  "Reunión cancelada",
  "2026-07-29T11:00:00-05:00",
  "2026-07-29T11:30:00-05:00",
  { status: "cancelled" },
);

const busyDayEvents: CalendarEvent[] = [
  morningStandup,
  recentlyEndedMeeting,
  inProgressMeeting,
  startingSoonMeeting,
  tomorrowMeeting,
  recurringMasterWithNoInstanceInWindow,
  cancelledMeeting,
];

const activeConnection = connection("active", new Date("2026-01-01T00:00:00Z"), BUSY_DAY_NOW);

export const busyDayCalendarSnapshot: CalendarSnapshot = getCalendarSnapshot(busyDayEvents, activeConnection, {
  now: BUSY_DAY_NOW,
});

// ---------------------------------------------------------------------------
// Límite real de zona horaria, documentado a propósito (ver README, "Límite
// real: fronteras de 'hoy' en UTC, no en hora de Bogotá") -- Calendar
// Foundation calcula "hoy" con `startOfUtcDay`, que SIEMPRE devuelve un
// instante a las 00:00:00Z; la medianoche real de Bogotá cae a las 05:00:00Z,
// nunca a las 00:00:00Z. Ningún ajuste de `now` puede hacer que ambas
// coincidan -- se investigó un ajuste (restar el offset antes de llamar) y se
// descartó: corrige la FECHA en algunos casos, pero no la FRONTERA exacta, y
// puede ocultar el problema en vez de resolverlo. Corregirlo de verdad
// requiere que Calendar Foundation reciba una zona horaria real (ver
// `features/reality/README.md`, punto de extensión #5) -- fuera del alcance
// de esta misión ("Do NOT modify... Calendar Foundation").
//
// Este escenario reproduce el límite tal cual: a las 10pm hora de Bogotá,
// una reunión de esa misma mañana (9am) ya no aparece ni en `today` ni en
// `upcoming`, porque para entonces la frontera UTC de "hoy" ya rodó al día
// calendario siguiente.
// ---------------------------------------------------------------------------

const BOUNDARY_LIMITATION_NOW = new Date("2026-07-29T22:00:00-05:00");

const boundaryLimitationEvents: CalendarEvent[] = [morningStandup];

const boundaryLimitationConnection = connection("active", new Date("2026-01-01T00:00:00Z"), BOUNDARY_LIMITATION_NOW);

export const boundaryLimitationCalendarSnapshot: CalendarSnapshot = getCalendarSnapshot(
  boundaryLimitationEvents,
  boundaryLimitationConnection,
  { now: BOUNDARY_LIMITATION_NOW },
);

/**
 * Mismo escenario exacto de arriba, pero pasando `timeZone` (misión
 * "Experience Intelligence V1": confirmada en producción vía captura
 * de pantalla real -- un evento de la noche anterior aparecía bajo
 * "hoy" en `/dashboard`). Demuestra que el parámetro aditivo SÍ
 * corrige el límite: el standup de las 9am debe seguir apareciendo en
 * `today` a las 10pm hora de Bogotá, en vez de desaparecer.
 */
export const boundaryLimitationFixedCalendarSnapshot: CalendarSnapshot = getCalendarSnapshot(
  boundaryLimitationEvents,
  boundaryLimitationConnection,
  { now: BOUNDARY_LIMITATION_NOW, timeZone: "America/Bogota" },
);

// ---------------------------------------------------------------------------
// Estados de sincronización, independientes de la hora del día.
// ---------------------------------------------------------------------------

export const neverSyncedConnection = connection("active", BUSY_DAY_NOW, BUSY_DAY_NOW);
export const neverSyncedCalendarSnapshot: CalendarSnapshot = getCalendarSnapshot([], neverSyncedConnection, {
  now: BUSY_DAY_NOW,
});

export const errorConnection = connection("error", new Date("2026-01-01T00:00:00Z"), BUSY_DAY_NOW);
export const errorCalendarSnapshot: CalendarSnapshot = getCalendarSnapshot([], errorConnection, {
  now: BUSY_DAY_NOW,
});
