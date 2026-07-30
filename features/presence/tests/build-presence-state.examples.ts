import { buildPresenceState } from "../application/build-presence-state";
import type { PresenceState } from "../domain/presence-state";
import { buildSnapshot, SCENARIOS } from "./fixtures";

/**
 * Script standalone con datos sintéticos, ejecutable con
 * `npx tsx features/presence/tests/build-presence-state.examples.ts`
 * -- mismo criterio de verificación que ya usan
 * `build-life-observations.ts`/`build-follow-up-recommendations.ts`
 * (WAR_ROOM_AUDIT_2026-07-29.md: "un script standalone... con datos
 * sintéticos", no hay framework de unit tests en este repo). No forma
 * parte de `smoke/runner.ts` -- no toca HTTP ni base de datos.
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const CHECKS: Record<string, (state: PresenceState) => void> = {
  "busy work day"(state) {
    assert(state.urgency === "critical", `se esperaba urgency "critical", llegó "${state.urgency}"`);
    assert(
      state.primaryFocus?.type === "goal_at_risk" && state.primaryFocus.priority === "high",
      "primaryFocus debía ser el goal_at_risk de prioridad alta",
    );
    assert(state.attentionNeeded.length === 3, "attentionNeeded debía recortarse a 3 (de 4 accionables)");
    assert(state.recentProgress.length === 0, "recentProgress debía estar vacío");
    assert(state.encouragement === null, "encouragement debía ser null (ninguna señal positiva)");
  },
  "calm productive day"(state) {
    assert(state.urgency === "low", `se esperaba urgency "low", llegó "${state.urgency}"`);
    assert(state.attentionNeeded.length === 0, "attentionNeeded debía estar vacío");
    assert(state.recentProgress.length === 2, "recentProgress debía tener las 2 celebraciones");
    assert(state.encouragement !== null, "encouragement no debía ser null");
  },
  "recovery day"(state) {
    assert(state.urgency === "medium", `se esperaba urgency "medium", llegó "${state.urgency}"`);
    assert(state.encouragement === null, "encouragement debía ser null (ninguna señal positiva)");
    assert(state.primaryFocus?.type === "habit_abandoned", "primaryFocus debía ser habit_abandoned");
    assert(state.attentionNeeded.length === 2, "attentionNeeded debía tener las 2 recomendaciones accionables");
  },
  "relationship day"(state) {
    assert(state.urgency === "high", `se esperaba urgency "high", llegó "${state.urgency}"`);
    assert(state.primaryFocus?.type === "neglected_relationship", "primaryFocus debía ser neglected_relationship");
    assert(state.encouragement !== null, "encouragement no debía ser null");
    assert(state.attentionNeeded.length === 1, "attentionNeeded debía tener 1 recomendación (RECONNECT_PERSON)");
    assert(state.recentProgress.length === 1, "recentProgress debía tener 1 celebración");
  },
  "goal crisis"(state) {
    assert(state.urgency === "critical", `se esperaba urgency "critical", llegó "${state.urgency}"`);
    assert(state.attentionNeeded.length === 3, "attentionNeeded debía tener las 3 recomendaciones (exactamente el tope)");
    assert(state.recentProgress.length === 0, "recentProgress debía estar vacío");
    assert(state.encouragement === null, "encouragement debía ser null (una crisis no inventa una celebración)");
    assert(
      state.primaryFocus?.type === "contradiction_detected",
      "primaryFocus debía ser la contradicción (misma prioridad que el otro goal_at_risk, primero en orden de llegada)",
    );
    assert(state.secondaryFocus?.type === "goal_at_risk", "secondaryFocus debía ser el goal_at_risk vencido");
  },
  "celebration day"(state) {
    assert(state.urgency === "low", `se esperaba urgency "low", llegó "${state.urgency}"`);
    assert(state.attentionNeeded.length === 0, "attentionNeeded debía estar vacío");
    assert(state.recentProgress.length === 3, "recentProgress debía recortarse a 3 (de 4 celebraciones)");
    assert(
      state.encouragement !== null && state.encouragement.includes("3 cosas"),
      "encouragement debía contar exactamente las 3 celebraciones mostradas, no las 4 generadas",
    );
  },
  "empty account (new user)"(state) {
    assert(state.primaryFocus === null, "primaryFocus debía ser null");
    assert(state.secondaryFocus === null, "secondaryFocus debía ser null");
    assert(state.attentionNeeded.length === 0, "attentionNeeded debía estar vacío");
    assert(state.recentProgress.length === 0, "recentProgress debía estar vacío");
    assert(state.encouragement === null, "encouragement debía ser null");
    assert(state.urgency === "low", `se esperaba urgency "low" por defecto, llegó "${state.urgency}"`);
    assert(typeof state.greeting === "string" && state.greeting.length > 0, "greeting debía calcularse igual, incluso sin datos");
  },
};

let hasFailure = false;

for (const scenario of SCENARIOS) {
  const snapshot = buildSnapshot(scenario);
  const state = buildPresenceState(scenario.observations, snapshot, scenario.recommendations);

  try {
    CHECKS[scenario.name]?.(state);
    console.log(`PASS  ${scenario.name}`);
  } catch (error) {
    hasFailure = true;
    console.log(`FAIL  ${scenario.name}: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log(JSON.stringify(state, null, 2));
  console.log("");
}

if (hasFailure) {
  process.exit(1);
}
