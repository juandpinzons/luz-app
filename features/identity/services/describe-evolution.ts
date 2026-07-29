import { DrizzleBeliefRepository } from "../../../core/belief-engine";
import type { Database } from "../../../core/db/client";
import { DrizzleInsightRepository } from "../../../core/knowledge-engine";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import {
  buildEvolutionTimeline,
  summarizeEvolution,
  type BeliefChangeInput,
  type EvolutionEvent,
  type EvolutionSummary,
  type InsightDiscoveryInput,
} from "../../../core/temporal-evolution";

export interface EvolutionReport {
  timeline: EvolutionEvent[];
  summary: EvolutionSummary;
}

/**
 * Ensamblador de aplicación (mismo rol que `assembleRealitySnapshot`):
 * lee `core/belief-engine`/`core/knowledge-engine` reales y los
 * traduce a la forma neutral que `core/temporal-evolution` sabe
 * combinar -- la frontera anti-corrupción vive aquí, nunca dentro de
 * ese módulo. Consumido por Identity Model y por el endpoint de
 * LifeGraph (expandir un nodo → "evolución temporal").
 */
export async function describeEvolution(
  db: Database,
  context: LifeGraphContext,
  windowDays = 90,
): Promise<EvolutionReport> {
  const beliefRepository = new DrizzleBeliefRepository(db);
  const insightRepository = new DrizzleInsightRepository(db);

  const [beliefs, insights] = await Promise.all([
    beliefRepository.list(context),
    insightRepository.list(context),
  ]);

  // War Room 2026-07-29: antes, un `await` por Belief dentro de un
  // `for` -- round-trips estrictamente secuenciales a Postgres, nunca
  // paralelizados (a diferencia del `Promise.all` de arriba). Con
  // decenas de Beliefs acumulados (nada los archiva ni los borra
  // todavía) esto añadía segundos de latencia solo para reconstruir el
  // historial de confianza. Mismo llamador, mismo método público de
  // `BeliefRepository` (`getHistory`, sin tocar su contrato) -- solo se
  // invoca en paralelo en vez de uno por uno.
  const beliefHistories = await Promise.all(
    beliefs.map((belief) => beliefRepository.getHistory(context, belief.id)),
  );

  const beliefChanges: BeliefChangeInput[] = [];
  beliefs.forEach((belief, index) => {
    for (const entry of beliefHistories[index]) {
      beliefChanges.push({
        beliefId: belief.id,
        statement: belief.statement,
        domain: belief.domain,
        previousConfidence: entry.previousConfidence,
        newConfidence: entry.newConfidence,
        changedAt: entry.changedAt,
      });
    }
  });

  const insightDiscoveries: InsightDiscoveryInput[] = insights
    .filter((insight) => insight.status === "validated" && insight.validatedAt)
    .map((insight) => ({
      insightId: insight.id,
      description: insight.description,
      validatedAt: insight.validatedAt as Date,
    }));

  const timeline = buildEvolutionTimeline(beliefChanges, insightDiscoveries);

  return { timeline, summary: summarizeEvolution(timeline, windowDays) };
}
