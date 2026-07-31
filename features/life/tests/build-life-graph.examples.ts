import { createEntityId } from "../../../core/life";
import type { Memory } from "../../../core/memory-engine";
import type { InsightExplanation } from "../../knowledge/services/explain-insight";
import type { LifeTimeline } from "../services/get-life-timeline";
import type { ValidatedInsights } from "../../knowledge/services/list-validated-insights";
import { assembleLifeGraph, type LifeGraphSummary } from "../services/build-life-graph";

/**
 * Script standalone con datos sintéticos, ejecutable con
 * `npx tsx features/life/tests/build-life-graph.examples.ts` -- mismo
 * criterio que `features/home/tests/`, `features/presence/tests/` y
 * `features/experience/tests/` (no hay framework de unit tests en
 * este repo).
 *
 * Bug real encontrado en producción: dos cuentas distintas (con
 * cantidades reales de memorias/insights muy distintas) mostraban
 * "15"/"5" idénticos en el mapa de Vida -- ambas superaban el tope de
 * exhibición de `getLifeTimeline`/`listValidatedInsights`, y el conteo
 * mostrado era `items.length` (el tope), nunca el total real. Este
 * script prueba que `assembleLifeGraph` usa `total`, no `items.length`,
 * y que expone un desglose real por categoría.
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function memory(id: string, type: Memory["type"], content: string): Memory {
  return {
    id: createEntityId(id),
    lifeGraphId: createEntityId("life-graph-1"),
    type,
    content,
    source: "conversation",
    status: "active",
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
  };
}

function insight(id: string, type: InsightExplanation["type"], reason: string): InsightExplanation {
  return {
    id: createEntityId(id),
    type,
    reason,
    evidence: [],
    evidenceCount: 2,
    firstEvidenceAt: null,
    mostRecentEvidenceAt: null,
    daysSinceMostRecentEvidence: null,
    spanDays: null,
  };
}

function emptyBase() {
  return { goals: [], projects: [], habits: [], relationships: [], beliefs: [], concepts: [] };
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

function findBranch(summary: LifeGraphSummary, id: string) {
  const branch = summary.branches.find((b) => b.id === id);
  assert(branch, `rama "${id}" debía existir`);
  return branch!;
}

runScenario("dos cuentas con el mismo tope de exhibición pero totales reales distintos NUNCA se ven iguales", () => {
  // Ambas cuentas tienen más memorias/insights que el tope de exhibición (15/5) -- antes del fix, ambas habrían mostrado "15"/"5" idénticos.
  const cappedItems = Array.from({ length: 15 }, (_, i) => memory(`m-${i}`, "fact", `memoria ${i}`));
  const cappedInsightItems = Array.from({ length: 5 }, (_, i) => insight(`i-${i}`, "fact", `insight ${i}`));

  const accountA: LifeTimeline = { items: cappedItems, total: 23, byType: { fact: 23 } };
  const accountB: LifeTimeline = { items: cappedItems, total: 104, byType: { fact: 104 } };
  const insightsA: ValidatedInsights = { items: cappedInsightItems, total: 8, byType: { fact: 8 } };
  const insightsB: ValidatedInsights = { items: cappedInsightItems, total: 41, byType: { fact: 41 } };

  const summaryA = assembleLifeGraph({ ...emptyBase(), timeline: accountA, insights: insightsA });
  const summaryB = assembleLifeGraph({ ...emptyBase(), timeline: accountB, insights: insightsB });

  assert(findBranch(summaryA, "recuerdos").count === 23, "cuenta A: recuerdos.count debía ser el total real (23), no items.length (15)");
  assert(findBranch(summaryB, "recuerdos").count === 104, "cuenta B: recuerdos.count debía ser el total real (104), no items.length (15)");
  assert(
    findBranch(summaryA, "recuerdos").count !== findBranch(summaryB, "recuerdos").count,
    "dos cuentas con totales reales distintos nunca deben mostrar el mismo conteo solo porque ambas superan el tope",
  );

  assert(findBranch(summaryA, "comprension").count === 8, "cuenta A: comprension.count debía ser el total real (8)");
  assert(findBranch(summaryB, "comprension").count === 41, "cuenta B: comprension.count debía ser el total real (41)");
});

runScenario("categorías reales -- desglose por tipo, ordenado de mayor a menor", () => {
  const timeline: LifeTimeline = {
    items: [memory("m-1", "fact", "hecho"), memory("m-2", "pattern", "patrón")],
    total: 9,
    byType: { fact: 6, pattern: 2, ritual: 1 },
  };
  const insights: ValidatedInsights = {
    items: [insight("i-1", "risk", "riesgo")],
    total: 3,
    byType: { risk: 2, preference: 1 },
  };

  const summary = assembleLifeGraph({ ...emptyBase(), timeline, insights });
  const recuerdos = findBranch(summary, "recuerdos");
  const comprension = findBranch(summary, "comprension");

  assert(recuerdos.categories?.length === 3, "recuerdos debía traer 3 categorías reales");
  assert(recuerdos.categories?.[0]?.label === "Hechos" && recuerdos.categories[0].count === 6, "la categoría con más conteo (Hechos, 6) debía ir primero");
  assert(recuerdos.categories?.[2]?.label === "Rituales" && recuerdos.categories[2].count === 1, "la de menor conteo (Rituales, 1) debía ir al final");

  assert(comprension.categories?.length === 2, "comprensión debía traer 2 categorías reales");
  assert(comprension.categories?.[0]?.label === "Riesgos", "Riesgos (2) debía ir antes que Preferencias (1)");
});

runScenario("cuenta vacía -- sin categorías fabricadas", () => {
  const empty: LifeTimeline = { items: [], total: 0, byType: {} };
  const emptyInsights: ValidatedInsights = { items: [], total: 0, byType: {} };

  const summary = assembleLifeGraph({ ...emptyBase(), timeline: empty, insights: emptyInsights });

  assert(findBranch(summary, "recuerdos").count === 0, "cuenta vacía: recuerdos.count debía ser 0");
  assert(findBranch(summary, "recuerdos").categories?.length === 0, "cuenta vacía: sin categorías inventadas");
});

if (hasFailure) {
  process.exit(1);
}
