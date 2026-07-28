import { derivePendingPredictions, type DomainMovement, type PredictivePatternCandidate } from "../core/predictive-engine";
import { createEntityId } from "../core/life";
import type { SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-06-01T00:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

function movement(
  domain: DomainMovement["domain"],
  direction: DomainMovement["direction"],
  daysAgoValue: number,
): DomainMovement {
  return {
    beliefId: createEntityId(crypto.randomUUID()),
    domain,
    direction,
    changedAt: daysAgo(daysAgoValue),
  };
}

const BASE_CANDIDATE: PredictivePatternCandidate = {
  fromDomain: "career",
  fromDirection: "strengthening",
  toDomain: "health",
  toDirection: "weakening",
  occurrences: 2,
  lastObservedAt: daysAgo(30),
  sampleFromBeliefId: createEntityId(crypto.randomUUID()),
  sampleToBeliefId: createEntityId(crypto.randomUUID()),
};

/**
 * Pura, sin IO, sin DB. `derivePendingPredictions` es la otra mitad de
 * Predictive Engine (la extensión "predicciones pendientes" de una
 * sesión anterior) -- su función hermana (`detectDomainCoMovement`)
 * tenía un bug real de sobreconteo encontrado en este mismo bloque, así
 * que amerita la misma verificación directa.
 */
export const predictivePendingFlow: SmokeFlow = {
  name: "predictive-pending",
  async run() {
    // Fixture 1: el gatillo (career→strengthening) se repitió hace 5
    // días, dentro de la ventana, y la consecuencia (health→weakening)
    // todavía no se observó -- debe producir una predicción pendiente
    // real.
    const triggerRecent = movement("career", "strengthening", 5);
    const pending = derivePendingPredictions([BASE_CANDIDATE], [triggerRecent], NOW);
    assert(pending.length === 1, `se esperaba 1 predicción pendiente, se obtuvieron ${pending.length}`);
    assert(pending[0]?.fromDomain === "career" && pending[0]?.toDomain === "health", "dominios incorrectos en la predicción");
    assert(pending[0]?.occurrences === 2, `occurrences debe heredarse tal cual del patrón confirmado, fue ${pending[0]?.occurrences}`);
    assert(
      pending[0]?.triggeredAt.getTime() === triggerRecent.changedAt.getTime(),
      "triggeredAt debe coincidir con el movimiento gatillo real",
    );

    // Fixture 2: sin ningún movimiento que coincida con el lado gatillo
    // del patrón -- nunca una predicción sin un gatillo real.
    const noTrigger = derivePendingPredictions(
      [BASE_CANDIDATE],
      [movement("finances", "strengthening", 1)],
      NOW,
    );
    assert(noTrigger.length === 0, `sin ningún movimiento gatillo real, no debería haber predicciones, se obtuvieron ${noTrigger.length}`);

    // Fixture 3: el gatillo más reciente ya pasó la ventana de 21 días
    // -- ya no cuenta como "acaba de repetirse".
    const staleTrigger = movement("career", "strengthening", 25);
    const stale = derivePendingPredictions([BASE_CANDIDATE], [staleTrigger], NOW);
    assert(stale.length === 0, `un gatillo de hace 25 días (fuera de la ventana de 21) no debería producir una predicción, se obtuvieron ${stale.length}`);

    // Fixture 4: la consecuencia YA se observó después del gatillo --
    // ya no es una predicción pendiente, es historia (detectDomainCoMovement
    // ya la habría contado como una ocurrencia confirmada más).
    const trigger = movement("career", "strengthening", 5);
    const alreadyHappened = movement("health", "weakening", 2); // 2 días atrás, DESPUÉS del gatillo (5 días atrás)
    const fulfilled = derivePendingPredictions([BASE_CANDIDATE], [trigger, alreadyHappened], NOW);
    assert(
      fulfilled.length === 0,
      `si la consecuencia ya se observó después del gatillo, no debería quedar como pendiente, se obtuvieron ${fulfilled.length}`,
    );

    // Fixture 5: hay dos movimientos gatillo -- debe usarse el MÁS
    // RECIENTE para decidir si sigue vigente, no el más viejo.
    const oldTrigger = movement("career", "strengthening", 40); // fuera de ventana
    const recentTrigger = movement("career", "strengthening", 3); // dentro de ventana
    const usesLatest = derivePendingPredictions([BASE_CANDIDATE], [oldTrigger, recentTrigger], NOW);
    assert(usesLatest.length === 1, `debería usar el gatillo más reciente (dentro de ventana), se obtuvieron ${usesLatest.length}`);
    assert(
      usesLatest[0]?.triggeredAt.getTime() === recentTrigger.changedAt.getTime(),
      "triggeredAt debería ser el gatillo MÁS RECIENTE, no el más viejo",
    );
  },
};
