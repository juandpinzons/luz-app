import type { Database } from "../../db/client";
import type { Project } from "../entities/project";
import type { LifeGraphContext } from "../life-graph-context";
import { DrizzleProjectRepository } from "../repositories/drizzle-project.repository";

/** Mismo criterio que `listRecentlyCompletedGoals`, para `Project`. */
export async function listRecentlyCompletedProjects(
  db: Database,
  context: LifeGraphContext,
  since: Date,
): Promise<Project[]> {
  return new DrizzleProjectRepository(db).listRecentlyCompleted(context, since);
}
