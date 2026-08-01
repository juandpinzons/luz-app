import { createExternalCalendarId, createExternalEventId } from "../../reality/domain";
import type { CalendarEvent } from "../../reality/domain";
import type { HomeCalendarContext } from "../../home/domain/home-state";
import { buildOrbState, buildOrbVisualState, type BuildOrbStateInput } from "../application/build-orb-state";

type BaseInputOverrides = {
  maturity?: Partial<BuildOrbStateInput["maturity"]>;
  moment?: Partial<BuildOrbStateInput["moment"]>;
};

/**
 * Script standalone con datos sintéticos, ejecutable con
 * `npx tsx features/orb/tests/orb-state.examples.ts` -- mismo criterio
 * que el resto de las carpetas tests/ dentro de features/ en este
 * repo. Objetivo F de la misión "Orb Experience V1": usuario nuevo,
 * usuario activo, semana silenciosa, reunión importante hoy, logro
 * reciente, reencuentro, determinismo, y evolución determinística.
 */

const NOW = new Date("2026-07-31T09:00:00-05:00");
const DAY_MS = 24 * 60 * 60 * 1000;

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

function meetingEvent(kind: "starting_soon" | "in_progress"): HomeCalendarContext {
  const event: CalendarEvent = {
    id: createExternalEventId("meeting-1"),
    calendarId: createExternalCalendarId("calendar-personal"),
    title: "Reunión importante",
    status: "confirmed",
    timing: {
      isAllDay: false,
      dateTime: NOW,
      timeZone: "America/Bogota",
      endDateTime: new Date(NOW.getTime() + 30 * 60 * 1000),
      endTimeZone: "America/Bogota",
    },
    attendees: [],
    lastModifiedAt: NOW,
  };

  return {
    status: "up_to_date",
    today: [event],
    upcomingEvents: [],
    freeBlocks: [],
    recurringCommitments: [],
    meetingMoments: [{ kind, event }],
  };
}

/** Entradas "todo neutral" -- solo se sobreescribe lo que cada escenario necesita, para que quede claro qué señal real está probando. */
function baseInput(overrides: BaseInputOverrides = {}): BuildOrbStateInput {
  return {
    personId: "person-test",
    now: NOW,
    maturity: {
      totalMessageCount: 0,
      hasCommunicationStyleSignal: false,
      hasGrowingBelief: false,
      hasPendingCuriosityQuestion: false,
      nearestDeadlineAt: null,
      ...overrides.maturity,
    },
    moment: {
      mostRecentMemoryAt: null,
      msSinceLastMessage: null,
      calendar: null,
      mostRecentCompletionAt: null,
      mostRecentRelationshipTouchAt: null,
      ...overrides.moment,
    },
  };
}

runScenario("usuario nuevo -- spark, sin ningún momento activo (estado calmo)", () => {
  const state = buildOrbState(baseInput());

  assert(state.maturityStage === "spark", `se esperaba "spark", llegó "${state.maturityStage}"`);
  assert(
    typeof state.paletteName === "string" && state.paletteName.length > 0,
    "debía resolver a una paleta real (la asignación en sí, determinismo incluido, ya se prueba en features/orb/tests/orb-palette.examples.ts)",
  );
  assert(
    !state.moment.hadMeaningfulConversationRecently &&
      !state.moment.hasBeenQuiet &&
      !state.moment.hasImportantMeetingSoon &&
      !state.moment.completedSomethingRecently &&
      !state.moment.reconnectedRecently,
    "sin ninguna señal real todavía, todos los campos de moment debían ser false -- estado calmo, no un caso especial",
  );
});

runScenario("usuario activo -- radiant, más cálido que un usuario nuevo", () => {
  const state = buildOrbState(baseInput({ maturity: { totalMessageCount: 150 } }));
  const newUser = buildOrbState(baseInput());

  assert(state.maturityStage === "radiant", `150 mensajes debía ser "radiant", llegó "${state.maturityStage}"`);
  assert(state.warmth > newUser.warmth, "un usuario activo debía tener más calidez de base que uno nuevo");

  const visual = buildOrbVisualState(baseInput({ maturity: { totalMessageCount: 150 } }));
  assert(visual.outerGlowAlpha > 0, "radiant debía traer una segunda capa de luz (outerGlowAlpha > 0)");
});

runScenario("semana silenciosa -- luz más suave, ritmo más lento, nunca invisible", () => {
  const quiet = buildOrbVisualState(baseInput({ moment: { msSinceLastMessage: 6 * DAY_MS } }));
  const normal = buildOrbVisualState(baseInput({ moment: { msSinceLastMessage: 1 * DAY_MS } }));

  assert(quiet.coreGlowAlpha < normal.coreGlowAlpha, "varios días de silencio debían suavizar el brillo central");
  assert(quiet.glowBlurPx > normal.glowBlurPx, "varios días de silencio debían difuminar más la luz (más blur)");
  assert(quiet.rhythmMs > normal.rhythmMs, "varios días de silencio debían relajar el ritmo de respiración");
  assert(quiet.coreGlowAlpha > 0, "nunca debe volverse invisible, ni en la semana más silenciosa");
});

runScenario("reunión importante hoy -- ritmo más presente, alcance mayor", () => {
  const withMeeting = buildOrbVisualState(baseInput({ moment: { calendar: meetingEvent("starting_soon") } }));
  const without = buildOrbVisualState(baseInput());

  assert(withMeeting.rhythmMs < without.rhythmMs, "una reunión por empezar debía acelerar un poco el ritmo");
  assert(withMeeting.glowSpreadPx > without.glowSpreadPx, "una reunión por empezar debía ensanchar un poco el alcance del resplandor");
});

runScenario("logro reciente -- halo un poco más fuerte, nunca una animación nueva", () => {
  const achieved = buildOrbVisualState(baseInput({ moment: { mostRecentCompletionAt: NOW } }));
  const without = buildOrbVisualState(baseInput());

  assert(achieved.coreGlowAlpha > without.coreGlowAlpha, "completar algo reciente debía subir un poco el brillo central");
});

runScenario("reencuentro con una relación -- borde cálido propio, nunca mezclado con el brillo central", () => {
  const reconnected = buildOrbVisualState(baseInput({ moment: { mostRecentRelationshipTouchAt: NOW } }));
  const without = buildOrbVisualState(baseInput());

  assert(reconnected.edgeWarmthAlpha > 0, "un reencuentro reciente debía activar el aro cálido");
  assert(without.edgeWarmthAlpha === 0, "sin reencuentro reciente, el aro cálido debía estar apagado");
  assert(
    reconnected.coreGlowAlpha === without.coreGlowAlpha,
    "el reencuentro es su propio canal -- nunca debía filtrarse al brillo central",
  );
});

runScenario("misma realidad => resultado visual idéntico (Objetivo C)", () => {
  const input = baseInput({
    maturity: { totalMessageCount: 42, hasGrowingBelief: true },
    moment: { msSinceLastMessage: 2 * 60 * 60 * 1000, mostRecentMemoryAt: NOW },
  });

  const first = buildOrbVisualState(input);
  const second = buildOrbVisualState(input);

  assert(JSON.stringify(first) === JSON.stringify(second), "la misma entrada debía producir exactamente el mismo OrbVisualState");
});

runScenario("realidad cambiada => evolución determinística, nunca aleatoria (Objetivo C)", () => {
  const yesterday = buildOrbVisualState(baseInput({ moment: { msSinceLastMessage: 5 * DAY_MS } }));
  const today = buildOrbVisualState(
    baseInput({ moment: { msSinceLastMessage: 5 * 60 * 1000, mostRecentMemoryAt: NOW } }),
  );

  assert(
    JSON.stringify(yesterday) !== JSON.stringify(today),
    "una conversación real después de varios días de silencio debía cambiar el resultado visual",
  );

  // Repetir la misma "hoy" varias veces debe seguir dando exactamente lo mismo -- la variación viene de que la realidad cambió, nunca de aleatoriedad.
  const todayAgain = buildOrbVisualState(
    baseInput({ moment: { msSinceLastMessage: 5 * 60 * 1000, mostRecentMemoryAt: NOW } }),
  );
  assert(JSON.stringify(today) === JSON.stringify(todayAgain), "repetir la misma realidad debía seguir siendo determinístico");
});

if (hasFailure) {
  process.exit(1);
}
