import {
  buildEvolutionTimeline,
  summarizeEvolution,
  type BeliefChangeInput,
  type InsightDiscoveryInput,
} from "../core/temporal-evolution";
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

/**
 * Pura, sin IO, sin DB -- mismo criterio que el resto de módulos
 * puros cubiertos en este bloque. Fecha `NOW` fija (nunca `Date.now()`)
 * para que `summarizeEvolution` (que compara contra "ahora") sea
 * 100% reproducible.
 */
export const temporalEvolutionFlow: SmokeFlow = {
  name: "temporal-evolution",
  async run() {
    const beliefId = createEntityId(crypto.randomUUID());

    // buildEvolutionTimeline: previousConfidence indefinido -> belief_created.
    const created: BeliefChangeInput = {
      beliefId,
      statement: "Smoke: le importa correr",
      domain: "health",
      newConfidence: 60,
      changedAt: daysAgo(10),
    };
    // newConfidence > previousConfidence -> belief_strengthened.
    const strengthened: BeliefChangeInput = {
      beliefId,
      statement: "Smoke: le importa correr",
      domain: "health",
      previousConfidence: 60,
      newConfidence: 75,
      changedAt: daysAgo(5),
    };
    // newConfidence < previousConfidence -> belief_weakened.
    const weakened: BeliefChangeInput = {
      beliefId: createEntityId(crypto.randomUUID()),
      statement: "Smoke: otra creencia",
      domain: "career",
      previousConfidence: 80,
      newConfidence: 65,
      changedAt: daysAgo(3),
    };
    // newConfidence === previousConfidence -> nunca un evento (ningún
    // cambio real que reportar).
    const unchanged: BeliefChangeInput = {
      beliefId: createEntityId(crypto.randomUUID()),
      statement: "Smoke: sin cambio real",
      domain: "career",
      previousConfidence: 50,
      newConfidence: 50,
      changedAt: daysAgo(2),
    };
    const discovery: InsightDiscoveryInput = {
      insightId: createEntityId(crypto.randomUUID()),
      description: "Smoke: insight descubierto",
      validatedAt: daysAgo(1),
    };

    const timeline = buildEvolutionTimeline(
      [created, strengthened, weakened, unchanged],
      [discovery],
    );

    assert(
      timeline.length === 4,
      `se esperaban 4 eventos (created+strengthened+weakened+discovery, 'unchanged' no cuenta), se obtuvieron ${timeline.length}`,
    );
    assert(timeline.some((e) => e.kind === "belief_created"), "falta el evento belief_created");
    assert(timeline.some((e) => e.kind === "belief_strengthened"), "falta el evento belief_strengthened");
    assert(timeline.some((e) => e.kind === "belief_weakened"), "falta el evento belief_weakened");
    assert(timeline.some((e) => e.kind === "insight_discovered"), "falta el evento insight_discovered");

    // Orden descendente por fecha -- lo más reciente primero.
    for (let i = 1; i < timeline.length; i += 1) {
      assert(
        timeline[i]!.occurredAt.getTime() <= timeline[i - 1]!.occurredAt.getTime(),
        `buildEvolutionTimeline debe ordenar descendente por occurredAt, falló entre las posiciones ${i - 1} y ${i}`,
      );
    }
    assert(timeline[0]?.kind === "insight_discovered", "el evento más reciente (hace 1 día) debería ser el primero");

    // summarizeEvolution: una ventana de 7 días debe excluir el
    // belief_created (hace 10 días), incluir todo lo demás.
    const summary = summarizeEvolution(timeline, 7, NOW);
    assert(summary.newBeliefsCount === 0, `belief_created (hace 10 días) debería quedar fuera de una ventana de 7 días, newBeliefsCount fue ${summary.newBeliefsCount}`);
    assert(
      summary.improvedDomains.some((d) => d.domain === "health" && d.occurrences === 1),
      "improvedDomains debería incluir 'health' (belief_strengthened, hace 5 días)",
    );
    assert(
      summary.worsenedDomains.some((d) => d.domain === "career" && d.occurrences === 1),
      "worsenedDomains debería incluir 'career' (belief_weakened, hace 3 días)",
    );

    // Una ventana de 30 días sí debe incluir el belief_created.
    const widerSummary = summarizeEvolution(timeline, 30, NOW);
    assert(widerSummary.newBeliefsCount === 1, `con ventana de 30 días, newBeliefsCount debería ser 1, fue ${widerSummary.newBeliefsCount}`);
  },
};
