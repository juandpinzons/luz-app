import { buildNarrativeState } from "../application/build-narrative-state";
import type { NarrativeRelatedEntity, NarrativeRelatedEntityKind } from "../domain";
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
 * Cubre los ocho escenarios sintéticos que pide la misión original (job
 * interview, birthday, long-term goal, relationship recovery, medical
 * treatment, project completion, career change, vacation planning) MÁS
 * los cinco mecanismos nuevos del rediseño V2 (arco recurrente,
 * recuperación tras un revés, eco temporal, arco dormido, silencio por
 * repetición con excepción por prioridad) más verificaciones
 * estructurales (determinismo, ningún `NarrativeMoment` puede ganar
 * `currentActiveStory`, cuenta vacía).
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function entityRef(kind: NarrativeRelatedEntityKind, id: string, title: string): NarrativeRelatedEntity {
  return { kind, id, title };
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
    relatedEntities: [entityRef("calendar_event", "evt-interview", "Entrevista Acme")],
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

  assert(state.currentActiveStory?.current.id === loop.id, "la entrevista debía ganar currentActiveStory (única historia real)");
  assert(state.currentActiveStory?.current.chapter.stage === "beginning", "recién detectada -- capítulo beginning");
  assert(
    state.currentActiveStory?.current.reason === "important_meeting_upcoming",
    "razón esperada: important_meeting_upcoming",
  );
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
    relatedEntities: [entityRef("relationship", "rel-camila", "Amistad con Camila")],
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

  assert(state.currentActiveStory?.current.id === loop.id, "el aniversario debía ganar currentActiveStory");
  assert(state.currentActiveStory?.current.reason === "milestone_today", "razón esperada: milestone_today");
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
// 4. Relationship recovery (follow-up) -- recommendation/recommendation_pending,
//    ya en follow_up con varios intentos -- turning_point Y cerca del
//    umbral de "ready to be forgotten" al mismo tiempo (categorías se
//    solapan). Distinto del escenario 10 (recuperación de ARCO, tras un
//    revés real en un capítulo anterior).
// ---------------------------------------------------------------------------

runScenario("relationship recovery (follow-up) -- turning_point, también ready to be forgotten", () => {
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
    relatedEntities: [entityRef("person", "person-camila", "Camila")],
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
    relatedEntities: [entityRef("project", "project-migracion", "Migración de base de datos")],
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

  assert(state.currentActiveStory?.current.id === loop.id, "un desenlace positivo fresco debía ganar currentActiveStory");
  assert(state.currentActiveStory?.current.chapter.stage === "resolution", "capítulo esperado: resolution");
  assert(state.currentActiveStory?.current.reason === "celebration_moment", "razón esperada: celebration_moment");
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
    relatedEntities: [entityRef("calendar_event", "evt-vacaciones", "Vuelo a la playa")],
  });
  const nearLoop = makeLoop({
    title: "Reunión de equipo",
    origin: "calendar",
    reason: "important_meeting",
    sourceId: "evt-cercano",
    priority: "medium",
    relatedEntities: [entityRef("calendar_event", "evt-cercano", "Reunión de equipo")],
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
  assert(
    state.currentActiveStory?.current.id === nearLoop.id,
    "la historia con mayor score real debía ganar primary, no la de menor prioridad base",
  );
});

// ---------------------------------------------------------------------------
// 9. Arco recurrente -- dos capítulos, orígenes DISTINTOS, meses aparte,
//    sobre la MISMA meta real ("connect events months apart"). El
//    primero cerró bien, así que esto NO es recuperación (contraste con
//    el escenario 10).
// ---------------------------------------------------------------------------

runScenario("arco recurrente -- conecta dos capítulos de orígenes distintos, meses aparte", () => {
  const goal = entityRef("goal", "goal-freelance", "Empezar a hacer freelance");
  const firstAttemptResolved = daysAgo(90);
  const firstChapter = makeLoop({
    title: "Explorar freelance",
    origin: "memory",
    reason: "explicit_intention",
    sourceId: "mem-freelance-intent",
    createdAt: daysAgo(150),
    updatedAt: firstAttemptResolved,
    state: "resolved",
    resolution: {
      state: "resolved",
      resolvedAt: firstAttemptResolved,
      evidence: { kind: "goal_or_project_status_changed", observedAt: firstAttemptResolved, description: "Primer cliente conseguido." },
      outcome: { kind: "positive", summary: "Consiguió su primer cliente freelance.", capturedAt: firstAttemptResolved },
    },
    relatedEntities: [goal],
  });
  const secondChapter = makeLoop({
    title: "Meta: Empezar a hacer freelance",
    origin: "goal",
    reason: "deadline",
    sourceId: "goal-freelance",
    createdAt: daysAgo(5),
    relatedEntities: [goal],
  });

  const state = buildNarrativeState({
    homeState: makeHomeState(),
    experienceState: makeExperienceState(),
    loops: [firstChapter, secondChapter],
    recommendations: [],
    lifeDashboardSnapshot: makeLifeDashboardSnapshot(),
    calendar: null,
    email: null,
  });

  const arc = state.recurringArcs.find((candidate) => candidate.current.id === secondChapter.id);
  assert(arc !== undefined, "debía existir un arco recurrente con 2+ capítulos");
  assert(arc!.chapters.length === 2, "el arco debía tener exactamente 2 capítulos");
  assert(arc!.chapters[0]!.id === firstChapter.id, "el capítulo más antiguo debía ir primero (orden cronológico)");
  assert(arc!.state === "active", "el primer capítulo cerró bien -- esto NO es recuperación");
  assert(!arc!.isReturningAfterSetback, "sin revés previo real -- nunca recuperación fabricada");
});

// ---------------------------------------------------------------------------
// 10. Recuperación tras un revés -- un intento anterior sobre la MISMA
//     persona terminó `negative`, y un nuevo capítulo no terminal abre
//     después (Principio 7: "returning after a setback is not a new
//     story -- it's the same story, continuing").
// ---------------------------------------------------------------------------

runScenario("recuperación tras un revés -- welcome_back, nunca tratado como historia nueva", () => {
  const person = entityRef("person", "person-daniel", "Daniel");
  const firstAttemptFailed = daysAgo(150);
  const firstAttempt = makeLoop({
    title: "Reconectar con Daniel",
    origin: "recommendation",
    reason: "recommendation_pending",
    sourceId: "rec-daniel-1",
    createdAt: daysAgo(200),
    updatedAt: firstAttemptFailed,
    state: "resolved",
    resolution: {
      state: "resolved",
      resolvedAt: firstAttemptFailed,
      evidence: { kind: "relationship_updated", observedAt: firstAttemptFailed, description: "No hubo respuesta." },
      outcome: { kind: "negative", summary: "No respondió a los intentos de contacto.", capturedAt: firstAttemptFailed },
    },
    relatedEntities: [person],
  });
  const secondAttempt = makeLoop({
    title: "Reconectar con Daniel",
    origin: "recommendation",
    reason: "recommendation_pending",
    sourceId: "rec-daniel-2",
    priority: "high",
    createdAt: daysAgo(3),
    relatedEntities: [person],
  });

  const state = buildNarrativeState({
    homeState: makeHomeState(),
    experienceState: makeExperienceState(),
    loops: [firstAttempt, secondAttempt],
    recommendations: [],
    lifeDashboardSnapshot: makeLifeDashboardSnapshot(),
    calendar: null,
    email: null,
  });

  assert(state.currentActiveStory?.current.id === secondAttempt.id, "el segundo intento debía liderar");
  assert(state.currentActiveStory?.state === "recovering", "estado de arco esperado: recovering");
  assert(state.currentActiveStory?.isReturningAfterSetback === true, "debía marcarse como regreso tras un revés real");
  assert(state.continuation?.kind === "welcome_back", "continuación esperada: welcome_back, nunca resume/prepare como si fuera nuevo");
});

// ---------------------------------------------------------------------------
// 11. Eco temporal -- un capítulo pasado del mismo arco cae en la fecha
//     de hoy, un año atrás (Principio 8: "time itself is evidence").
// ---------------------------------------------------------------------------

runScenario("eco temporal -- un año exacto atrás, mismo arco", () => {
  const domain = entityRef("goal", "goal-viaje-anual", "Viaje anual");
  const oneYearAgo = new Date(NOW.getTime() - 365 * 24 * 60 * 60 * 1000);
  const pastTrip = makeLoop({
    title: "Viaje a Japón",
    origin: "memory",
    reason: "significant_life_event",
    sourceId: "mem-viaje-2025",
    createdAt: oneYearAgo,
    updatedAt: oneYearAgo,
    state: "resolved",
    resolution: {
      state: "resolved",
      resolvedAt: oneYearAgo,
      evidence: { kind: "goal_or_project_status_changed", observedAt: oneYearAgo, description: "Viaje completado." },
      outcome: { kind: "positive", summary: "Viaje a Japón completado.", capturedAt: oneYearAgo },
    },
    relatedEntities: [domain],
  });
  const newTripPlanning = makeLoop({
    title: "Planear el viaje de este año",
    origin: "memory",
    reason: "explicit_intention",
    sourceId: "mem-viaje-2026",
    priority: "medium",
    createdAt: daysAgo(3),
    relatedEntities: [domain],
  });

  const state = buildNarrativeState({
    homeState: makeHomeState(),
    experienceState: makeExperienceState(),
    loops: [pastTrip, newTripPlanning],
    recommendations: [],
    lifeDashboardSnapshot: makeLifeDashboardSnapshot(),
    calendar: null,
    email: null,
  });

  assert(state.currentActiveStory?.current.id === newTripPlanning.id, "el capítulo actual debía liderar");
  assert(state.currentActiveStory?.echo !== null, "debía detectarse un eco (mismo mes+día, hace >= 60 días)");
  assert(
    state.currentActiveStory?.echo?.sourceThreadId === pastTrip.id,
    "el eco debía apuntar al capítulo del año pasado",
  );
  assert(
    state.currentActiveStory?.echo?.intervalMonths === 12,
    `intervalMonths esperado ~12, fue ${state.currentActiveStory?.echo?.intervalMonths}`,
  );
  assert(state.continuation?.kind === "echo", "continuación esperada: echo");
});

// ---------------------------------------------------------------------------
// 12. Arco dormido -- un capítulo terminal `archived`, viejo, sin ningún
//     capítulo nuevo -- "revisit forgotten things", nunca framing de
//     fracaso (Principio 11), y excluido de currentActiveStory.
// ---------------------------------------------------------------------------

runScenario("arco dormido -- elegible para revisitar, nunca gana currentActiveStory", () => {
  const archivedAt = daysAgo(60);
  const loop = makeLoop({
    title: "Aprender guitarra",
    origin: "memory",
    reason: "explicit_intention",
    sourceId: "mem-guitarra",
    createdAt: daysAgo(200),
    updatedAt: archivedAt,
    state: "archived",
    resolution: {
      state: "archived",
      resolvedAt: archivedAt,
      evidence: { kind: "timeout_exceeded", observedAt: archivedAt, description: "Excedió 90 días de antigüedad sin resolverse." },
    },
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

  assert(
    state.dormantArcs.some((arc) => arc.current.id === loop.id),
    "debía aparecer en dormantArcs",
  );
  assert(
    state.currentActiveStory === null,
    "un capítulo archivado, sin nada más, nunca debía ganar currentActiveStory",
  );
});

// ---------------------------------------------------------------------------
// 13. Silencio por repetición, con excepción por prioridad -- una
//     historia de rutina (silenciable) ya narrada recientemente se
//     silencia y cede el paso a otra real; una historia `critical` con
//     la MISMA razón de rutina nunca se silencia (Principio 9).
// ---------------------------------------------------------------------------

runScenario("silencio -- rutina ya narrada cede el paso; alta prioridad nunca se silencia", () => {
  const routineLoop = makeLoop({
    title: "Leer más este año",
    origin: "memory",
    reason: "explicit_intention",
    sourceId: "mem-leer-mas",
    priority: "medium",
    createdAt: daysAgo(10),
  });
  const fallbackLoop = makeLoop({
    title: "Objetivo de respaldo",
    origin: "memory",
    reason: "explicit_intention",
    sourceId: "mem-respaldo",
    priority: "low",
    createdAt: daysAgo(10),
  });

  const baseInput = {
    homeState: makeHomeState(),
    experienceState: makeExperienceState(),
    loops: [routineLoop, fallbackLoop],
    recommendations: [],
    lifeDashboardSnapshot: makeLifeDashboardSnapshot(),
    calendar: null,
    email: null,
  };

  const firstVisit = buildNarrativeState(baseInput);
  assert(
    firstVisit.currentActiveStory?.current.id === routineLoop.id,
    "sin historial de qué ya se narró, la historia de mayor score debía ganar",
  );
  assert(firstVisit.silencedCandidate === null, "primera visita -- nada que silenciar todavía");

  const secondVisit = buildNarrativeState({ ...baseInput, recentlyNarratedThreadIds: [routineLoop.id] });
  assert(
    secondVisit.silencedCandidate?.arc.current.id === routineLoop.id,
    "la historia de rutina ya narrada debía quedar registrada como silenciada",
  );
  assert(secondVisit.silencedCandidate?.reason === "already_narrated_recently", "razón de silencio esperada");
  assert(
    secondVisit.currentActiveStory?.current.id === fallbackLoop.id,
    "currentActiveStory debía caer a la siguiente historia real, nunca quedar null habiendo otra real",
  );

  const criticalLoop = makeLoop({
    title: "Asunto crítico de rutina",
    origin: "memory",
    reason: "explicit_intention",
    sourceId: "mem-critico",
    priority: "critical",
    createdAt: daysAgo(10),
  });
  const thirdVisit = buildNarrativeState({
    ...baseInput,
    loops: [criticalLoop],
    recentlyNarratedThreadIds: [criticalLoop.id],
  });
  assert(
    thirdVisit.currentActiveStory?.current.id === criticalLoop.id,
    "prioridad critical nunca se silencia por repetición, sin importar la razón",
  );
  assert(thirdVisit.silencedCandidate === null, "nada debía silenciarse esta visita");
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
  assert(state.recurringArcs.length === 0, "recurringArcs debía estar vacío");
  assert(state.dormantArcs.length === 0, "dormantArcs debía estar vacío");
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

  assert(
    first.currentActiveStory?.current.id === second.currentActiveStory?.current.id,
    "currentActiveStory debía ser idéntico entre corridas",
  );
  assert(first.currentActiveStory?.score === second.currentActiveStory?.score, "score debía ser idéntico entre corridas");
  assert(JSON.stringify(first) === JSON.stringify(second), "el NarrativeState completo debía ser idéntico entre corridas");
});

if (hasFailure) {
  process.exit(1);
}
