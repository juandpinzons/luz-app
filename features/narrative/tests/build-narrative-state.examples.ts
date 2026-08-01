import { buildNarrativeState } from "../application/build-narrative-state";
import {
  daysAgo,
  hoursFromNow,
  makeCalendarEvent,
  makeCalendarSnapshot,
  makeExperienceState,
  makeHomeCalendarContext,
  makeHomeState,
  makeLifeDashboardSnapshot,
  makeLoop,
  NOW,
} from "./fixtures";

/**
 * Script standalone con datos sintéticos, ejecutable con
 * `npx tsx features/narrative/tests/build-narrative-state.examples.ts`
 * -- mismo criterio que `features/experience/tests/build-experience-state.examples.ts`
 * (no hay framework de unit tests en este repo). No forma parte de
 * `smoke/runner.ts` -- no toca HTTP ni base de datos.
 *
 * Cubre los ocho escenarios sintéticos que pide la misión (job
 * interview, birthday, long-term goal, relationship recovery, medical
 * treatment, project completion, career change, vacation planning) más
 * verificaciones estructurales (determinismo, ningún `NarrativeMoment`
 * puede ganar `currentActiveStory`, cuenta vacía).
 */

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

// ---------------------------------------------------------------------------
// 1. Job interview -- calendar/important_meeting, recién detectado, con
//    evento de calendario real correlacionado dentro de la ventana de
//    proximidad (48h).
// ---------------------------------------------------------------------------

runScenario("job interview -- beginning, important_meeting_upcoming, gana primary", () => {
  const event = makeCalendarEvent({ id: "evt-interview", title: "Entrevista Acme", hoursFromNow: 20, attendeeCount: 2 });
  const loop = makeLoop({
    title: "Entrevista Acme",
    origin: "calendar",
    reason: "important_meeting",
    sourceId: "evt-interview",
    priority: "high",
    relatedEntities: [{ kind: "calendar_event", id: "evt-interview", title: "Entrevista Acme" }],
  });

  const state = buildNarrativeState({
    homeState: makeHomeState({ calendar: makeHomeCalendarContext(makeCalendarSnapshot([event])) }),
    experienceState: makeExperienceState(),
    loops: [loop],
    recommendations: [],
    lifeDashboardSnapshot: makeLifeDashboardSnapshot(),
    calendar: makeCalendarSnapshot([event]),
    email: null,
  });

  assert(state.currentActiveStory?.id === loop.id, "la entrevista debía ganar currentActiveStory (única historia real)");
  assert(state.currentActiveStory?.chapter.stage === "beginning", "recién detectada -- capítulo beginning");
  assert(state.currentActiveStory?.reason === "important_meeting_upcoming", "razón esperada: important_meeting_upcoming");
  assert(state.continuation?.kind === "prepare", "continuación esperada: prepare");
  assert(state.openStories.length === 1, "debía aparecer en openStories");
});

// ---------------------------------------------------------------------------
// 2. Birthday -- relationship/relationship_milestone, hoy.
// ---------------------------------------------------------------------------

runScenario("birthday -- milestone_today, continuación celebrate", () => {
  const loop = makeLoop({
    title: "Cumpleaños de Camila",
    origin: "relationship",
    reason: "relationship_milestone",
    sourceId: "rel-camila",
    priority: "medium",
    relatedEntities: [{ kind: "relationship", id: "rel-camila", title: "Amistad con Camila" }],
  });

  const state = buildNarrativeState({
    homeState: makeHomeState(),
    experienceState: makeExperienceState(),
    loops: [loop],
    recommendations: [],
    lifeDashboardSnapshot: makeLifeDashboardSnapshot(),
    calendar: null,
    email: null,
  });

  assert(state.currentActiveStory?.id === loop.id, "el aniversario debía ganar currentActiveStory");
  assert(state.currentActiveStory?.reason === "milestone_today", "razón esperada: milestone_today");
  assert(state.continuation?.kind === "celebrate", "un aniversario hoy se continúa celebrando");
});

// ---------------------------------------------------------------------------
// 3. Long-term goal -- memory/explicit_intention, sin fecha, abierta hace
//    45 días -- developing + long-running, nunca "beginning".
// ---------------------------------------------------------------------------

runScenario("long-term goal -- developing, long_running_unresolved", () => {
  const loop = makeLoop({
    title: "Aprender a programar en serio",
    origin: "memory",
    reason: "explicit_intention",
    sourceId: "mem-aprender-programar",
    priority: "low",
    createdAt: daysAgo(45),
    updatedAt: daysAgo(20),
    relatedEntities: [],
  });

  const state = buildNarrativeState({
    homeState: makeHomeState(),
    experienceState: makeExperienceState(),
    loops: [loop],
    recommendations: [],
    lifeDashboardSnapshot: makeLifeDashboardSnapshot(),
    calendar: null,
    email: null,
  });

  const thread = state.openStories.find((candidate) => candidate.id === loop.id);
  assert(thread !== undefined, "debía aparecer en openStories");
  assert(thread!.chapter.stage === "developing", "45 días abierta -- capítulo developing, nunca beginning");
  assert(thread!.reason === "long_running_unresolved", "sin deadline/milestone real -- razón long_running_unresolved");
  assert(
    state.longRunningStories.some((candidate) => candidate.id === loop.id),
    "debía aparecer en longRunningStories (>= 30 días)",
  );
});

// ---------------------------------------------------------------------------
// 4. Relationship recovery -- recommendation/recommendation_pending, ya en
//    follow_up con varios intentos -- turning_point Y cerca del umbral de
//    "ready to be forgotten" al mismo tiempo (categorías se solapan).
// ---------------------------------------------------------------------------

runScenario("relationship recovery -- turning_point, también ready to be forgotten", () => {
  const loop = makeLoop({
    title: "Reconectar con Camila",
    origin: "recommendation",
    reason: "recommendation_pending",
    sourceId: "rec-reconnect-camila",
    priority: "high",
    state: "follow_up",
    followUpAttempts: 4,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(1),
    relatedEntities: [{ kind: "person", id: "person-camila", title: "Camila" }],
  });

  const state = buildNarrativeState({
    homeState: makeHomeState(),
    experienceState: makeExperienceState(),
    loops: [loop],
    recommendations: [],
    lifeDashboardSnapshot: makeLifeDashboardSnapshot(),
    calendar: null,
    email: null,
  });

  const thread = state.storiesReadyForFollowUp.find((candidate) => candidate.id === loop.id);
  assert(thread !== undefined, "debía aparecer en storiesReadyForFollowUp (state: follow_up)");
  assert(thread!.chapter.stage === "turning_point", "capítulo esperado: turning_point");
  assert(thread!.reason === "follow_up_due", "razón esperada: follow_up_due (más específica que fading)");
  assert(
    state.storiesReadyToBeForgotten.some((candidate) => candidate.id === loop.id),
    "followUpAttempts=4 (a un intento del límite de 5) -- debía aparecer también en storiesReadyToBeForgotten",
  );
  assert(state.continuation?.kind === "check_in", "continuación esperada: check_in");
});

// ---------------------------------------------------------------------------
// 5. Medical treatment -- memory/significant_life_event, esperando el
//    próximo control (waiting).
// ---------------------------------------------------------------------------

runScenario("medical treatment -- waiting_quietly, peso emocional fijo", () => {
  const loop = makeLoop({
    title: "Control médico de seguimiento",
    origin: "memory",
    reason: "significant_life_event",
    sourceId: "mem-tratamiento",
    priority: "medium",
    state: "waiting",
    createdAt: daysAgo(10),
    updatedAt: daysAgo(2),
    nextFollowUpAt: hoursFromNow(72),
    relatedEntities: [],
  });

  const state = buildNarrativeState({
    homeState: makeHomeState(),
    experienceState: makeExperienceState(),
    loops: [loop],
    recommendations: [],
    lifeDashboardSnapshot: makeLifeDashboardSnapshot(),
    calendar: null,
    email: null,
  });

  const thread = state.storiesWaitingQuietly.find((candidate) => candidate.id === loop.id);
  assert(thread !== undefined, "debía aparecer en storiesWaitingQuietly");
  assert(thread!.chapter.stage === "waiting", "capítulo esperado: waiting");
  assert(thread!.reason === "waiting_quietly", "razón esperada: waiting_quietly");
  assert(state.continuation?.kind === "resume", "continuación esperada: resume");
});

// ---------------------------------------------------------------------------
// 6. Project completion -- project/deadline, ya resuelto con desenlace
//    positivo real -- resolution + celebración.
// ---------------------------------------------------------------------------

runScenario("project completion -- resolution, celebration_moment", () => {
  const resolvedAt = daysAgo(1);
  const loop = makeLoop({
    title: "Migración de base de datos",
    origin: "project",
    reason: "deadline",
    sourceId: "project-migracion",
    priority: "high",
    state: "resolved",
    createdAt: daysAgo(20),
    updatedAt: resolvedAt,
    resolution: {
      state: "resolved",
      resolvedAt,
      evidence: { kind: "goal_or_project_status_changed", observedAt: resolvedAt, description: "Proyecto completado." },
      outcome: { kind: "positive", summary: "Proyecto completado a tiempo.", capturedAt: resolvedAt },
    },
    relatedEntities: [{ kind: "project", id: "project-migracion", title: "Migración de base de datos" }],
  });

  const state = buildNarrativeState({
    homeState: makeHomeState(),
    experienceState: makeExperienceState(),
    loops: [loop],
    recommendations: [],
    lifeDashboardSnapshot: makeLifeDashboardSnapshot(),
    calendar: null,
    email: null,
  });

  assert(state.currentActiveStory?.id === loop.id, "un desenlace positivo fresco debía ganar currentActiveStory");
  assert(state.currentActiveStory?.chapter.stage === "resolution", "capítulo esperado: resolution");
  assert(state.currentActiveStory?.reason === "celebration_moment", "razón esperada: celebration_moment");
  assert(state.continuation?.kind === "celebrate", "continuación esperada: celebrate");
  assert(
    state.recentlyClosedStories.some((candidate) => candidate.id === loop.id),
    "debía aparecer en recentlyClosedStories",
  );
  assert(
    state.celebrationCandidates.some((moment) => moment.relatedThreadId === loop.id),
    "debía aparecer en celebrationCandidates, referenciando el mismo thread (nunca duplicado)",
  );
});

// ---------------------------------------------------------------------------
// 7. Career change -- memory/explicit_intention, recién detectado --
//    mismo origen/razón que el long-term goal (escenario 3), pero fresco:
//    prueba que la EDAD, no el origen, decide beginning vs developing.
// ---------------------------------------------------------------------------

runScenario("career change -- beginning (misma razón que long-term goal, pero recién detectada)", () => {
  const loop = makeLoop({
    title: "Cambiar a un rol de ingeniería de datos",
    origin: "memory",
    reason: "explicit_intention",
    sourceId: "mem-cambio-carrera",
    priority: "medium",
    createdAt: NOW,
    relatedEntities: [],
  });

  const state = buildNarrativeState({
    homeState: makeHomeState(),
    experienceState: makeExperienceState(),
    loops: [loop],
    recommendations: [],
    lifeDashboardSnapshot: makeLifeDashboardSnapshot(),
    calendar: null,
    email: null,
  });

  const thread = state.openStories.find((candidate) => candidate.id === loop.id);
  assert(thread !== undefined, "debía aparecer en openStories");
  assert(thread!.chapter.stage === "beginning", "recién detectada -- capítulo beginning, no developing");
  assert(thread!.reason === "continuing_open_story", "sin ninguna condición especial todavía -- razón por defecto");
  assert(!thread!.isLongRunning, "recién detectada -- nunca long-running");
});

// ---------------------------------------------------------------------------
// 8. Vacation planning -- calendar/future_commitment, evento lejano (20
//    días, fuera de la ventana de proximidad de 48h) -- prueba que la
//    ventana de proximidad de verdad excluye eventos lejanos del bono.
// ---------------------------------------------------------------------------

runScenario("vacation planning -- future_commitment, evento lejano sin bono de proximidad", () => {
  const farEvent = makeCalendarEvent({ id: "evt-vacaciones", title: "Vuelo a la playa", hoursFromNow: 20 * 24 });
  const nearEvent = makeCalendarEvent({ id: "evt-cercano", title: "Reunión de equipo", hoursFromNow: 5, attendeeCount: 3 });

  const farLoop = makeLoop({
    title: "Vuelo a la playa",
    origin: "calendar",
    reason: "future_commitment",
    sourceId: "evt-vacaciones",
    priority: "medium",
    relatedEntities: [{ kind: "calendar_event", id: "evt-vacaciones", title: "Vuelo a la playa" }],
  });
  const nearLoop = makeLoop({
    title: "Reunión de equipo",
    origin: "calendar",
    reason: "important_meeting",
    sourceId: "evt-cercano",
    priority: "medium",
    relatedEntities: [{ kind: "calendar_event", id: "evt-cercano", title: "Reunión de equipo" }],
  });

  const calendar = makeCalendarSnapshot([farEvent, nearEvent]);
  const state = buildNarrativeState({
    homeState: makeHomeState({ calendar: makeHomeCalendarContext(calendar) }),
    experienceState: makeExperienceState(),
    loops: [farLoop, nearLoop],
    recommendations: [],
    lifeDashboardSnapshot: makeLifeDashboardSnapshot(),
    calendar,
    email: null,
  });

  const farThread = state.openStories.find((candidate) => candidate.id === farLoop.id)!;
  const nearThread = state.openStories.find((candidate) => candidate.id === nearLoop.id)!;
  assert(farThread.reason === "approaching_deadline", "future_commitment -- razón esperada: approaching_deadline");
  assert(
    nearThread.score > farThread.score,
    `la reunión próxima (5h, dentro de la ventana de 48h) debía superar a la lejana (480h): near=${nearThread.score} far=${farThread.score}`,
  );
  assert(state.currentActiveStory?.id === nearLoop.id, "la historia con mayor score real debía ganar primary, no la de menor prioridad base");
});

// ---------------------------------------------------------------------------
// Verificaciones estructurales
// ---------------------------------------------------------------------------

runScenario("cuenta vacía -- nada inventado", () => {
  const state = buildNarrativeState({
    homeState: makeHomeState(),
    experienceState: makeExperienceState(),
    loops: [],
    recommendations: [],
    lifeDashboardSnapshot: makeLifeDashboardSnapshot(),
    calendar: null,
    email: null,
  });

  assert(state.currentActiveStory === null, "sin loops -- currentActiveStory debía ser null");
  assert(state.continuation === null, "sin historia activa -- continuation debía ser null");
  assert(state.openStories.length === 0, "openStories debía estar vacío");
  assert(state.celebrationCandidates.length === 0, "celebrationCandidates debía estar vacío");
});

runScenario("un NarrativeMoment nunca puede ganar currentActiveStory", () => {
  const state = buildNarrativeState({
    homeState: makeHomeState(),
    experienceState: makeExperienceState(),
    loops: [],
    recommendations: [
      {
        id: "rec-celebrar",
        type: "CELEBRATE_PROGRESS",
        priority: "critical",
        title: "Celebrar progreso",
        explanation: "Progreso real sin loop propio.",
        evidence: [],
        relatedEntities: [],
        suggestedAction: { kind: "acknowledge" },
        confidence: 0.9,
      },
    ],
    lifeDashboardSnapshot: makeLifeDashboardSnapshot(),
    calendar: null,
    email: null,
  });

  assert(
    state.currentActiveStory === null,
    "una recomendación sin loop propio (momento, no historia) nunca debía ganar currentActiveStory, sin importar su score",
  );
  assert(state.celebrationCandidates.length === 1, "sí debía aparecer como celebrationCandidate");
});

runScenario("determinismo -- mismas entradas, mismo resultado", () => {
  const loop = makeLoop({
    title: "Objetivo estable",
    origin: "goal",
    reason: "deadline",
    sourceId: "goal-estable",
    priority: "medium",
    createdAt: daysAgo(5),
  });

  const input = {
    homeState: makeHomeState(),
    experienceState: makeExperienceState(),
    loops: [loop],
    recommendations: [],
    lifeDashboardSnapshot: makeLifeDashboardSnapshot(),
    calendar: null,
    email: null,
  };

  const first = buildNarrativeState(input);
  const second = buildNarrativeState(input);

  assert(first.currentActiveStory?.id === second.currentActiveStory?.id, "currentActiveStory debía ser idéntico entre corridas");
  assert(first.currentActiveStory?.score === second.currentActiveStory?.score, "score debía ser idéntico entre corridas");
  assert(JSON.stringify(first) === JSON.stringify(second), "el NarrativeState completo debía ser idéntico entre corridas");
});

if (hasFailure) {
  process.exit(1);
}
