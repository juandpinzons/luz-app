import type { Database } from "../../db/client";
import type { Goal } from "../entities/goal";
import type { LifeGraphContext } from "../life-graph-context";
import { DrizzleGoalRepository } from "../repositories/drizzle-goal.repository";

/**
 * Objetivos que se completaron dentro de la ventana `since` -- lo que
 * consume `AcknowledgeClosureStrategyRule` (redesign del pipeline
 * conversacional, Beta). Filtro resuelto en SQL
 * (`DrizzleGoalRepository.listRecentlyCompleted`), mismo criterio de
 * rendimiento que `listActiveGoals`.
 */
export async function listRecentlyCompletedGoals(
  db: Database,
  context: LifeGraphContext,
  since: Date,
): Promise<Goal[]> {
  return new DrizzleGoalRepository(db).listRecentlyCompleted(context, since);
}
