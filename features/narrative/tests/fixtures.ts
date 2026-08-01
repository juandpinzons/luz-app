import type { ContinuityLoop, LoopOrigin, LoopPriority, LoopReason, LoopState } from "../../../core/continuity-engine";
import { createEntityId, GOAL_STATUSES, PROJECT_STATUSES, type GoalStatus, type ProjectStatus } from "../../../core/life";
import type { ExperienceState, RealityFingerprint } from "../../experience/domain/experience-state";
import type { HomeCalendarContext, HomeState } from "../../home/domain/home-state";
import type { LifeDashboardSnapshot } from "../../dashboard/services/build-life-dashboard-snapshot";
import {
  createExternalCalendarId,
  createExternalEventId,
  type CalendarEvent,
  type CalendarSnapshot,
} from "../../reality/domain";

/**
 * Constructores sintéticos compartidos por `build-narrative-state.examples.ts`
 * -- mismo criterio que `features/presence/tests/fixtures.ts`: un solo
 * lugar arma los datos mínimos válidos de cada contrato de entrada, para
 * que cada escenario solo declare lo que de verdad quiere ejercitar.
 */

export const NOW = new Date("2026-08-01T09:00:00-05:00");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function hoursFromNow(hours: number): Date {
  return new Date(NOW.getTime() + hours * 60 * 60 * 1000);
}

let loopSequence = 0;

export interface MakeLoopInput {
  readonly title: string;
  readonly origin: LoopOrigin;
  readonly reason: LoopReason;
  readonly sourceId: string;
  readonly summary?: string;
  readonly state?: LoopState;
  readonly priority?: LoopPriority;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
  readonly followUpAttempts?: number;
  readonly nextFollowUpAt?: Date;
  readonly resolution?: ContinuityLoop["resolution"];
  readonly relatedEntities?: ContinuityLoop["relatedEntities"];
}

/** `ContinuityLoop` mínimo válido -- todo campo con un default razonable, sobreescribible por escenario. */
export function makeLoop(input: MakeLoopInput): ContinuityLoop {
  loopSequence += 1;
  const createdAt = input.createdAt ?? NOW;

  return {
    id: createEntityId(`loop-${loopSequence}`),
    lifeGraphId: createEntityId("life-graph-1"),
    trigger: {
      origin: input.origin,
      reason: input.reason,
      sourceId: input.sourceId,
      detectedAt: createdAt,
      summary: input.summary ?? input.title,
    },
    title: input.title,
    state: input.state ?? "open",
    priority: input.priority ?? "medium",
    resolution: input.resolution,
    nextFollowUpAt: input.nextFollowUpAt,
    followUpAttempts: input.followUpAttempts ?? 0,
    relatedEntities: input.relatedEntities ?? [],
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
  };
}

export function makeCalendarEvent(input: {
  id: string;
  title: string;
  hoursFromNow: number;
  durationHours?: number;
  attendeeCount?: number;
}): CalendarEvent {
  const start = hoursFromNow(input.hoursFromNow);
  const end = hoursFromNow(input.hoursFromNow + (input.durationHours ?? 1));
  return {
    id: createExternalEventId(input.id),
    calendarId: createExternalCalendarId("calendar-1"),
    title: input.title,
    status: "confirmed",
    timing: { isAllDay: false, dateTime: start, timeZone: "America/Bogota", endDateTime: end, endTimeZone: "America/Bogota" },
    attendees: Array.from({ length: input.attendeeCount ?? 0 }, (_, index) => ({
      email: `persona-${index}@example.com`,
      responseStatus: "accepted" as const,
      isOrganizer: false,
    })),
    lastModifiedAt: NOW,
  };
}

export function makeCalendarSnapshot(events: CalendarEvent[]): CalendarSnapshot {
  return {
    generatedAt: NOW,
    today: events.filter((event) => !event.timing.isAllDay && event.timing.dateTime.getTime() < hoursFromNow(24).getTime()),
    upcoming: events,
    freeBlocks: [],
    busyPeriods: [],
    recurringCommitments: [],
    syncStatus: { state: "up_to_date", lastSyncedAt: NOW },
  };
}

/**
 * `HomeState.calendar` espera `HomeCalendarContext` (proyección propia de
 * `features/home/`), no un `CalendarSnapshot` crudo -- este constructor
 * hace la proyección mínima necesaria para escenarios sintéticos
 * (`meetingMoments: []` a propósito: ningún escenario de esta misión
 * ejercita momentos derivados de calendario, así que poblarlo agregaría
 * ruido sin ejercitar nada).
 */
export function makeHomeCalendarContext(calendar: CalendarSnapshot): HomeCalendarContext {
  return {
    status: calendar.syncStatus.state,
    today: calendar.today,
    upcomingEvents: calendar.upcoming,
    freeBlocks: calendar.freeBlocks,
    recurringCommitments: calendar.recurringCommitments,
    meetingMoments: [],
  };
}

function zeroGoalStatusCounts(): Record<GoalStatus, number> {
  return Object.fromEntries(GOAL_STATUSES.map((status) => [status, 0])) as Record<GoalStatus, number>;
}

function zeroProjectStatusCounts(): Record<ProjectStatus, number> {
  return Object.fromEntries(PROJECT_STATUSES.map((status) => [status, 0])) as Record<ProjectStatus, number>;
}

export function makeLifeDashboardSnapshot(
  overrides: Partial<LifeDashboardSnapshot> = {},
): LifeDashboardSnapshot {
  return {
    generatedAt: NOW,
    domains: [],
    overdue: [],
    upcoming: [],
    stalled: [],
    relationships: { total: 0, byType: {} },
    totals: {
      goalsByStatus: zeroGoalStatusCounts(),
      projectsByStatus: zeroProjectStatusCounts(),
      activeHabits: 0,
      inactiveHabits: 0,
    },
    observations: [],
    ...overrides,
  };
}

export function makeHomeState(overrides: Partial<HomeState> = {}): HomeState {
  return {
    asOf: NOW,
    greeting: "Buenos días.",
    lifeContext: {
      totals: {
        goalsByStatus: zeroGoalStatusCounts(),
        projectsByStatus: zeroProjectStatusCounts(),
        activeHabits: 0,
        inactiveHabits: 0,
      },
      domains: [],
      relationships: { total: 0, byType: {} },
      observationCount: 0,
      recommendationCount: 0,
    },
    currentFocus: { primary: null, secondary: null },
    attentionNeeded: [],
    recentProgress: { encouragement: null, items: [] },
    urgency: "low",
    quickActions: [],
    upcoming: [],
    calendar: null,
    ...overrides,
  };
}

function emptyFingerprint(): RealityFingerprint {
  return {
    memoriesStored: 0,
    goalsCompleted: 0,
    projectsCompleted: 0,
    observationCount: 0,
    recommendationCount: 0,
    relationshipTotal: 0,
  };
}

export function makeExperienceState(overrides: Partial<ExperienceState> = {}): ExperienceState {
  return {
    asOf: NOW,
    primary: null,
    secondary: [],
    postponed: [],
    tone: "low",
    isNewPrimary: false,
    whatChanged: [],
    fingerprint: emptyFingerprint(),
    ...overrides,
  };
}

export { daysAgo, hoursFromNow };
