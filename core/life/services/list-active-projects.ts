import type { Database } from "../../db/client";
import type { Project } from "../entities/project";
import type { LifeGraphContext } from "../life-graph-context";
import { DrizzleProjectRepository } from "../repositories/drizzle-project.repository";

/**
 * Proyectos que todavía están en curso — lo que consume Reality
 * Snapshot (`life.activeProjects`). Filtro resuelto en SQL
 * (`DrizzleProjectRepository.listActive`), no en JS -- mismo criterio
 * que `listActiveGoals` (auditoría de rendimiento, Fase I "Graph
 * Performance").
 */
export async function listActiveProjects(
  db: Database,
  context: LifeGraphContext,
): Promise<Project[]> {
  return new DrizzleProjectRepository(db).listActive(context);
}
