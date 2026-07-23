import type { Database } from "../../../core/db/client";
import {
  type Project,
  type LifeGraphContext,
  DrizzleProjectRepository,
} from "../../../core/life";

/** Todos los Projects del LifeGraph, sin filtrar por estado — ver list-all-goals.ts. */
export async function listAllProjects(
  db: Database,
  context: LifeGraphContext,
): Promise<Project[]> {
  return new DrizzleProjectRepository(db).list(context);
}
