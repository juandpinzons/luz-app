import type { Database } from "../../db/client";
import type { Goal } from "../entities/goal";
import type { LifeGraphContext } from "../life-graph-context";
import { DrizzleGoalRepository } from "../repositories/drizzle-goal.repository";

const INACTIVE_GOAL_STATUSES = new Set(["completed", "abandoned"]);

/** Objetivos que todavía están en curso — lo que consume Reality Snapshot (`life.activeGoals`). */
export async function listActiveGoals(
  db: Database,
  context: LifeGraphContext,
): Promise<Goal[]> {
  const goals = await new DrizzleGoalRepository(db).list(context);

  return goals.filter((goal) => !INACTIVE_GOAL_STATUSES.has(goal.status));
}
