import { createEntityId } from "../../../core/life";
import type { FollowUpRecommendation } from "../../dashboard/services/build-follow-up-recommendations";
import type { HomeState } from "../../home/domain/home-state";
import { buildExperienceState } from "../application/build-experience-state";

/**
 * Script standalone con datos sintéticos, ejecutable con
 * `npx tsx features/experience/tests/build-experience-state.examples.ts`
 * -- mismo criterio que `features/home/tests/build-home-state.examples.ts`
 * y `features/presence/tests/build-presence-state.examples.ts` (no hay
 * framework de unit tests en este repo). No forma parte de
 * `smoke/runner.ts` -- no toca HTTP ni base de datos.
 *
 * A diferencia de esos dos, lo que hay que demostrar aquí no es un
 * solo `HomeState` sino una SECUENCIA de días -- la validación de la
 * misión pide explícitamente verificar que abrir Home varias veces a
 * lo largo de varios días simulados produce experiencias distintas
 * cuando la realidad cambia. Cada escenario simula esa secuencia a
 * mano, acumulando `recentPrimaryKeys` como lo haría
 * `getRecentPrimaryKeys` en producción.
 */

const NOW = new Date("2026-07-29T09:00:00-05:00");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function makeRecommendation(id: string, priority: FollowUpRecommendation["priority"], title: string): FollowUpRecommendation {
  return {
    id,
    type: "GOAL_REVIEW",
    priority,
    title,
    explanation: `${title} -- explicación sintética.`,
    evidence: [],
    relatedEntities: [{ kind: "goal", id: createEntityId(id), title }],
    suggestedAction: { kind: "open_entity", targetEntity: { kind: "goal", id: createEntityId(id), title } },
    confidence: 0.8,
  };
}

/** `HomeState` mínimo válido con solo `attentionNeeded` poblado -- todo lo demás en su valor "nada que decidir", igual que el escenario "empty account" de Home/Presence. `lifeContext` es parcialmente sobreescribible para el escenario de "¿qué cambió?" (necesita variar `goalsByStatus.completed`/`observationCount`/`relationships.total` entre visitas simuladas, todo lo demás igual). */
function makeHomeState(
  attentionNeeded: FollowUpRecommendation[],
  lifeContextOverrides: Partial<HomeState["lifeContext"]> = {},
): HomeState {
  return {
    asOf: NOW,
    greeting: "Buenos días.",
    lifeContext: {
      totals: { goalsByStatus: { active: 0, paused: 0, completed: 0, abandoned: 0 }, projectsByStatus: { planning: 0, active: 0, on_hold: 0, completed: 0, cancelled: 0 }, activeHabits: 0, inactiveHabits: 0 },
      domains: [],
      relationships: { total: 0, byType: {} },
      observationCount: 0,
      recommendationCount: attentionNeeded.length,
      ...lifeContextOverrides,
    },
    currentFocus: { primary: null, secondary: null },
    attentionNeeded,
    recentProgress: { encouragement: null, items: [] },
    urgency: "low",
    quickActions: [],
    upcoming: [],
    calendar: null,
  };
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

runScenario("rotación forzada al tercer día seguido", () => {
  const a = makeRecommendation("goal-a", "high", "Objetivo A");
  const b = makeRecommendation("goal-b", "medium", "Objetivo B");
  const homeState = makeHomeState([a, b]);
  let recentPrimaryKeys: string[] = [];

  const day1 = buildExperienceState(homeState, recentPrimaryKeys);
  assert(day1.primary?.key === "attention:goal-a", "día 1: A (más importante) debía ganar");
  recentPrimaryKeys = [day1.primary!.key, ...recentPrimaryKeys];

  const day2 = buildExperienceState(homeState, recentPrimaryKeys);
  assert(day2.primary?.key === "attention:goal-a", "día 2: A todavía no debía tener cooldown (solo 1 racha)");
  recentPrimaryKeys = [day2.primary!.key, ...recentPrimaryKeys];

  const day3 = buildExperienceState(homeState, recentPrimaryKeys);
  assert(day3.primary?.key === "attention:goal-b", "día 3: A debía ceder el primario a B por cooldown (2 días seguidos ya)");
  assert(
    day3.postponed.some((card) => card.key === "attention:goal-a"),
    "día 3: A debía aparecer en postponed, nunca perderse del todo",
  );
  assert(day3.isNewPrimary, "día 3: el primario cambió respecto al día anterior");
});

runScenario("sin alternativa real -- nunca inventa variedad", () => {
  const onlyOne = makeRecommendation("goal-solo", "critical", "Único objetivo real");
  const homeState = makeHomeState([onlyOne]);
  let recentPrimaryKeys: string[] = [];

  for (let day = 0; day < 3; day += 1) {
    const state = buildExperienceState(homeState, recentPrimaryKeys);
    assert(state.primary?.key === "attention:goal-solo", `día ${day + 1}: única candidata real debía seguir ganando`);
    assert(state.postponed.length === 0, `día ${day + 1}: postponed debía estar vacío (no hay ninguna otra candidata)`);
    recentPrimaryKeys = [state.primary!.key, ...recentPrimaryKeys];
  }
});

runScenario("la realidad cambia -> la experiencia cambia, sin esperar cooldown", () => {
  const yesterdayIssue = makeRecommendation("goal-ayer", "high", "Problema de ayer");
  const day1 = buildExperienceState(makeHomeState([yesterdayIssue]), []);
  assert(day1.primary?.key === "attention:goal-ayer", "día 1: el único problema real debía ganar");

  // El problema de ayer se resolvió (ya no aparece en `attentionNeeded`); apareció uno nuevo.
  const todayIssue = makeRecommendation("goal-hoy", "critical", "Problema nuevo de hoy");
  const day2 = buildExperienceState(makeHomeState([todayIssue]), [day1.primary!.key]);
  assert(day2.primary?.key === "attention:goal-hoy", "día 2: el problema nuevo debía liderar -- el de ayer ya no existe como candidata");
  assert(day2.isNewPrimary, "día 2: cambiar de problema real cuenta como nueva experiencia primaria");
});

runScenario("recomendaciones con título genérico -- título/detalle deben diferenciar y ocultar evidencia cruda", () => {
  // Reproduce el bug real encontrado en producción (captura de `/dashboard`):
  // dos recomendaciones `FOCUS_DOMAIN` de dominios distintos comparten el
  // mismo `recommendation.title` genérico ("Enfocar dominio") y traen
  // evidencia cruda entre corchetes en `explanation`.
  const first = makeRecommendation("goal-x", "medium", "Objetivo X");
  const second = makeRecommendation("goal-y", "medium", "Objetivo Y");
  first.title = "Enfocar dominio";
  first.explanation = `Enfocar dominio: "${first.relatedEntities[0]!.title}" [activeItems=0, everHadActivity=false].`;
  second.title = "Enfocar dominio";
  second.explanation = `Enfocar dominio: "${second.relatedEntities[0]!.title}" [activeItems=0, everHadActivity=false].`;

  const state = buildExperienceState(makeHomeState([first, second]), []);
  const cards = [state.primary, ...state.secondary].filter((card): card is NonNullable<typeof card> => card !== null);

  assert(cards.length === 2, "debían existir 2 tarjetas (dos entidades reales distintas)");
  assert(
    cards[0]!.title !== cards[1]!.title,
    "las dos tarjetas debían tener títulos distintos, aunque compartan el título genérico de la recomendación",
  );
  for (const card of cards) {
    assert(!card.detail.includes("["), `detail no debía exponer evidencia cruda entre corchetes: "${card.detail}"`);
  }
});

runScenario("¿qué cambió? detecta memorias/goals/observaciones nuevas entre visitas, nunca fabrica novedad", () => {
  const issue = makeRecommendation("goal-persistente", "medium", "Objetivo de siempre");

  // Día 1: primera visita real con historial -- sin huella previa, `whatChanged` debe venir vacío (no hay "antes" contra qué comparar), aunque memoriesStored/observationCount no sean 0.
  const day1HomeState = makeHomeState([issue], {
    totals: { goalsByStatus: { active: 1, paused: 0, completed: 0, abandoned: 0 }, projectsByStatus: { planning: 0, active: 0, on_hold: 0, completed: 0, cancelled: 0 }, activeHabits: 0, inactiveHabits: 0 },
    observationCount: 1,
  });
  const day1 = buildExperienceState(day1HomeState, [], 2, null);
  assert(day1.whatChanged.length === 0, "día 1 (sin huella previa): whatChanged debía venir vacío, nunca fabricado");

  // Día 2: misma cuenta, la realidad avanzó de verdad -- 3 memorias nuevas, 1 goal completado, 2 observaciones nuevas.
  const day2HomeState = makeHomeState([issue], {
    totals: { goalsByStatus: { active: 0, paused: 0, completed: 1, abandoned: 0 }, projectsByStatus: { planning: 0, active: 0, on_hold: 0, completed: 0, cancelled: 0 }, activeHabits: 0, inactiveHabits: 0 },
    observationCount: 3,
  });
  const day2 = buildExperienceState(day2HomeState, [day1.primary!.key], 5, day1.fingerprint);

  const byType = new Map(day2.whatChanged.map((change) => [change.type, change.count]));
  assert(byType.get("new_memories") === 3, `día 2: se esperaban 3 memorias nuevas, hubo ${byType.get("new_memories")}`);
  assert(byType.get("goal_completed") === 1, `día 2: se esperaba 1 goal completado, hubo ${byType.get("goal_completed")}`);
  assert(byType.get("new_observation") === 2, `día 2: se esperaban 2 observaciones nuevas, hubo ${byType.get("new_observation")}`);
  assert(!byType.has("project_completed"), "día 2: ningún project cambió, no debía reportarse");
  assert(!byType.has("new_relationship"), "día 2: ninguna relación cambió, no debía reportarse");

  // Día 3: nada cambió desde el día 2 -- whatChanged debe volver a estar vacío, nunca repetir el mismo cambio dos veces.
  const day3 = buildExperienceState(day2HomeState, [day2.primary!.key, day1.primary!.key], 5, day2.fingerprint);
  assert(day3.whatChanged.length === 0, "día 3 (nada cambió desde el día 2): whatChanged debía venir vacío");
});

if (hasFailure) {
  process.exit(1);
}
