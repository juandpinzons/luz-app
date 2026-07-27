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

  const beliefChanges: BeliefChangeInput[] = [];
  for (const belief of beliefs) {
    const history = await beliefRepository.getHistory(context, belief.id);
    for (const entry of history) {
      beliefChanges.push({
        beliefId: belief.id,
        statement: belief.statement,
        domain: belief.domain,
        previousConfidence: entry.previousConfidence,
        newConfidence: entry.newConfidence,
        changedAt: entry.changedAt,
      });
    }
  }

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
