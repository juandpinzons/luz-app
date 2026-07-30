import type { LifeDashboardSnapshot } from "../../dashboard/services/build-life-dashboard-snapshot";
import { buildPresenceState } from "../../presence/application/build-presence-state";
import { buildSnapshot, emptyAccount, SCENARIOS, type Scenario } from "../../presence/tests/fixtures";
import { buildHomeState } from "../application/build-home-state";
import type { HomeState } from "../domain/home-state";
import type { CalendarSnapshot } from "../../reality/domain";
import {
  boundaryLimitationCalendarSnapshot,
  busyDayCalendarSnapshot,
  errorCalendarSnapshot,
  MORNING_MEETING_ID,
  neverSyncedCalendarSnapshot,
  RECURRING_SERIES_TITLE,
} from "./calendar-fixtures";
import { highlyActiveUser } from "./fixtures";

/**
 * Reusa los 7 escenarios compartidos de
 * `features/presence/tests/fixtures.ts` y agrega el octavo propio de
 * Home (`./fixtures.ts`) -- nunca una segunda copia de los mismos
 * datos. Corre la cadena completa `buildPresenceState` ->
 * `buildHomeState` y verifica dos cosas a la vez: que `HomeState` sea
 * correcto, y que sea un passthrough real de `PresenceState` (nunca
 * una segunda decisión). Standalone, con datos sintéticos, mismo
 * criterio que `features/presence/tests/`.
 *
 * Ninguno de los 8 escenarios de Life Graph incluye calendario
 * conectado (`calendar: null`) -- ese es su propio eje de variación,
 * cubierto por separado más abajo con los fixtures de
 * `./calendar-fixtures.ts`.
 */

const HOME_SCENARIOS: Scenario[] = [...SCENARIOS, highlyActiveUser];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Invariantes de integración -- válidas para los 8 escenarios por
 * igual, sin excepción. Si alguna de estas fallara, significaría que
 * Home volvió a decidir algo que ya era responsabilidad de Presence
 * (justo lo que la misión pide evitar).
 */
function checkIntegrationInvariants(
  home: HomeState,
  presence: ReturnType<typeof buildPresenceState>,
  snapshot: LifeDashboardSnapshot,
): void {
  assert(home.asOf.getTime() === presence.asOf.getTime(), "asOf debía ser el mismo valor que presence.asOf");
  assert(home.greeting === presence.greeting, "greeting debía ser un passthrough exacto de presence.greeting");
  assert(home.lifeContext.totals === snapshot.totals, "lifeContext.totals debía ser el mismo objeto que snapshot.totals");
  assert(home.lifeContext.domains === snapshot.domains, "lifeContext.domains debía ser el mismo arreglo que snapshot.domains");
  assert(
    home.lifeContext.relationships === snapshot.relationships,
    "lifeContext.relationships debía ser el mismo objeto que snapshot.relationships",
  );
  assert(
    home.lifeContext.observationCount === snapshot.observations.length,
    "lifeContext.observationCount debía contar el total real de observaciones, no solo currentFocus",
  );
  assert(home.upcoming === snapshot.upcoming, "upcoming debía ser el mismo arreglo que snapshot.upcoming, nunca recalculado");
  assert(
    home.currentFocus.primary === presence.primaryFocus,
    "currentFocus.primary debía ser el mismo objeto que presence.primaryFocus",
  );
  assert(
    home.currentFocus.secondary === presence.secondaryFocus,
    "currentFocus.secondary debía ser el mismo objeto que presence.secondaryFocus",
  );
  assert(
    home.attentionNeeded === presence.attentionNeeded,
    "attentionNeeded debía ser el mismo arreglo que presence.attentionNeeded, nunca uno recalculado",
  );
  assert(
    home.recentProgress.items === presence.recentProgress,
    "recentProgress.items debía ser el mismo arreglo que presence.recentProgress",
  );
  assert(
    home.recentProgress.encouragement === presence.encouragement,
    "recentProgress.encouragement debía ser un passthrough exacto de presence.encouragement",
  );
  assert(home.urgency === presence.urgency, "urgency debía ser un passthrough exacto de presence.urgency");
  assert(
    home.quickActions.length === presence.attentionNeeded.length,
    "quickActions debía tener una entrada por cada recomendación accionable, ni más ni menos",
  );
  for (let i = 0; i < home.quickActions.length; i += 1) {
    assert(
      home.quickActions[i].recommendationId === presence.attentionNeeded[i].id,
      `quickActions[${i}] debía enlazar de vuelta a attentionNeeded[${i}] por id`,
    );
    assert(
      home.quickActions[i].action === presence.attentionNeeded[i].suggestedAction,
      `quickActions[${i}].action debía ser el mismo objeto que attentionNeeded[${i}].suggestedAction`,
    );
  }
}

const SCENARIO_CHECKS: Record<string, (home: HomeState) => void> = {
  "busy work day"(home) {
    assert(home.upcoming.length === 1, "upcoming debía traer el goal próximo a vencer del fixture");
    assert(home.upcoming[0].title === "Preparar revisión trimestral", "upcoming debía traer el ítem correcto");
  },
  "calm productive day"(home) {
    assert(home.upcoming.length === 0, "upcoming debía estar vacío (fixture sin datos para este escenario)");
  },
  "celebration day"(home) {
    assert(
      home.lifeContext.recommendationCount === 4,
      "recommendationCount debía contar las 4 recomendaciones generadas, no solo las 3 mostradas en recentProgress",
    );
    assert(home.upcoming.length === 1, "upcoming debía traer el project próximo a vencer del fixture");
  },
  "empty account (new user)"(home) {
    assert(home.lifeContext.observationCount === 0, "observationCount debía ser 0");
    assert(home.lifeContext.recommendationCount === 0, "recommendationCount debía ser 0");
    assert(home.quickActions.length === 0, "quickActions debía estar vacío");
    assert(home.upcoming.length === 0, "upcoming debía estar vacío (snapshot vacío en este fixture)");
    assert(home.currentFocus.primary === null, "currentFocus.primary debía ser null");
    assert(home.currentFocus.secondary === null, "currentFocus.secondary debía ser null");
  },
  "highly active user"(home) {
    assert(home.lifeContext.observationCount === 6, "observationCount debía contar las 6 observaciones generadas");
    assert(
      home.lifeContext.recommendationCount === 5,
      "recommendationCount debía contar las 5 recomendaciones generadas, no solo lo mostrado en attentionNeeded/recentProgress",
    );
    assert(
      home.attentionNeeded.length === 1,
      "attentionNeeded debía tener solo la revisión de portafolio (única recomendación accionable)",
    );
    assert(
      home.recentProgress.items.length === 3,
      "recentProgress debía recortarse a 3 (de 4 celebraciones), igual que en 'celebration day'",
    );
    assert(home.urgency === "medium", `se esperaba urgency "medium" (solo una revisión pendiente), llegó "${home.urgency}"`);
    assert(home.upcoming.length === 1, "upcoming debía traer el project próximo a vencer del fixture");
  },
};

let hasFailure = false;

function reportPass(name: string): void {
  console.log(`PASS  ${name}`);
}

function reportFail(name: string, error: unknown): void {
  hasFailure = true;
  console.log(`FAIL  ${name}: ${error instanceof Error ? error.message : String(error)}`);
}

for (const scenario of HOME_SCENARIOS) {
  const snapshot = buildSnapshot(scenario);
  const presence = buildPresenceState(scenario.observations, snapshot, scenario.recommendations);
  const home = buildHomeState(snapshot, scenario.observations, scenario.recommendations, presence, null);

  try {
    checkIntegrationInvariants(home, presence, snapshot);
    assert(home.calendar === null, "calendar debía ser null (ninguno de estos escenarios tiene calendario conectado)");
    SCENARIO_CHECKS[scenario.name]?.(home);
    reportPass(scenario.name);
  } catch (error) {
    reportFail(scenario.name, error);
  }

  console.log(JSON.stringify(home, null, 2));
  console.log("");
}

// ---------------------------------------------------------------------------
// Calendar: escenarios propios (Fase 3/4 de esta misión), aislados de las
// particularidades del Life Graph -- todos usan `emptyAccount` como base de
// Presence/Life Graph para que la única variable sea el calendario.
// ---------------------------------------------------------------------------

const emptyLifeGraphSnapshot = buildSnapshot(emptyAccount);
const emptyLifeGraphPresence = buildPresenceState(
  emptyAccount.observations,
  emptyLifeGraphSnapshot,
  emptyAccount.recommendations,
);

function buildHomeWithCalendar(calendar: CalendarSnapshot | null): HomeState {
  return buildHomeState(
    emptyLifeGraphSnapshot,
    emptyAccount.observations,
    emptyAccount.recommendations,
    emptyLifeGraphPresence,
    calendar,
  );
}

const CALENDAR_SCENARIOS: Array<{ name: string; run: () => void }> = [
  {
    name: "calendar: busy day with meetings",
    run() {
      const home = buildHomeWithCalendar(busyDayCalendarSnapshot);
      assert(home.calendar !== null, "calendar no debía ser null");
      const calendar = home.calendar!;

      assert(calendar.status === "up_to_date", `se esperaba status "up_to_date", llegó "${calendar.status}"`);
      assert(
        calendar.today.some((event) => event.id === MORNING_MEETING_ID),
        "today debía incluir el standup de la mañana",
      );
      assert(calendar.today.length === 4, `today debía tener 4 eventos, llegaron ${calendar.today.length}`);
      assert(
        calendar.upcomingEvents.length === 1 && calendar.upcomingEvents[0].title === "Planning Q3",
        "upcomingEvents debía traer solo el evento de mañana, sin repetir los de hoy",
      );
      assert(
        calendar.recurringCommitments.length === 1 && calendar.recurringCommitments[0].title === RECURRING_SERIES_TITLE,
        "recurringCommitments debía incluir la serie recurrente aunque su único evento sincronizado esté fuera de la ventana (Fase 1: mitigación de producto, no expansión de RRULE)",
      );
      assert(
        calendar.meetingMoments.length === 3,
        `meetingMoments debía tener 3 entradas (recently_ended, in_progress, starting_soon), llegaron ${calendar.meetingMoments.length}`,
      );
      assert(calendar.meetingMoments[0].kind === "recently_ended", "el primer momento debía ser 'recently_ended' (Review de diseño)");
      assert(calendar.meetingMoments[1].kind === "in_progress", "el segundo momento debía ser 'in_progress' (1:1 con Daniel)");
      assert(calendar.meetingMoments[2].kind === "starting_soon", "el tercer momento debía ser 'starting_soon' (Retro de sprint)");
    },
  },
  {
    name: "calendar: límite real de zona horaria (hallazgo de la Fase 2, sin resolver a propósito)",
    run() {
      // A las 10pm hora de Bogotá, la frontera UTC de "hoy" que usa Calendar
      // Foundation ya rodó al día calendario siguiente -- un evento de esa
      // misma mañana desaparece de `today` (y de `upcoming`, no solo se
      // "recategoriza"). Ver `features/home/README.md`, "Límite heredado de
      // Calendar Foundation": investigado y descartado un ajuste desde este
      // lado porque no puede ser exacto (`startOfUtcDay` solo devuelve
      // instantes a las 00:00:00Z; la medianoche real de Bogotá es
      // 05:00:00Z). Esta prueba documenta el límite tal cual es hoy, no lo
      // oculta.
      assert(
        !boundaryLimitationCalendarSnapshot.today.some((event) => event.id === MORNING_MEETING_ID),
        "el standup de las 9am debía desaparecer de 'today' a las 10pm hora de Bogotá -- si esto pasa, el límite documentado ya no es reproducible y este hallazgo debe revisarse",
      );
      assert(
        !boundaryLimitationCalendarSnapshot.upcoming.some((event) => event.id === MORNING_MEETING_ID),
        "el mismo evento tampoco debía aparecer en 'upcoming' -- no se recategoriza, desaparece por completo",
      );
    },
  },
  {
    name: "calendar: nunca sincronizado",
    run() {
      const home = buildHomeWithCalendar(neverSyncedCalendarSnapshot);
      assert(home.calendar !== null, "calendar no debía ser null (hay conexión, aunque nunca sincronizó)");
      assert(home.calendar!.status === "never_synced", `se esperaba "never_synced", llegó "${home.calendar!.status}"`);
      assert(home.calendar!.today.length === 0, "today debía estar vacío");
      assert(home.calendar!.recurringCommitments.length === 0, "recurringCommitments debía estar vacío");
    },
  },
  {
    name: "calendar: error de sincronización",
    run() {
      const home = buildHomeWithCalendar(errorCalendarSnapshot);
      assert(home.calendar !== null, "calendar no debía ser null (la conexión existe, aunque con error)");
      assert(home.calendar!.status === "error", `se esperaba "error", llegó "${home.calendar!.status}"`);
    },
  },
  {
    name: "calendar: sin conectar",
    run() {
      const home = buildHomeWithCalendar(null);
      assert(home.calendar === null, "calendar debía ser null cuando nunca hubo CalendarConnection");
    },
  },
];

for (const scenario of CALENDAR_SCENARIOS) {
  try {
    scenario.run();
    reportPass(scenario.name);
  } catch (error) {
    reportFail(scenario.name, error);
  }
}

console.log(JSON.stringify(buildHomeWithCalendar(busyDayCalendarSnapshot).calendar, null, 2));

if (hasFailure) {
  process.exit(1);
}
