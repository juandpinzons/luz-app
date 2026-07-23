import type { Database } from "../../db/client";
import type { Project } from "../entities/project";
import type { LifeGraphContext } from "../life-graph-context";
import { DrizzleProjectRepository } from "../repositories/drizzle-project.repository";

const INACTIVE_PROJECT_STATUSES = new Set(["completed", "cancelled"]);

/** Proyectos que todavía están en curso — lo que consume Reality Snapshot (`life.activeProjects`). */
export async function listActiveProjects(
  db: Database,
  context: LifeGraphContext,
): Promise<Project[]> {
  const projects = await new DrizzleProjectRepository(db).list(context);

  return projects.filter(
    (project) => !INACTIVE_PROJECT_STATUSES.has(project.status),
  );
}
