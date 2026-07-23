import type { Database } from "../../db/client";
import type { Project } from "../entities/project";
import type { LifeDomainType } from "../value-objects/life-domain-type";
import type { LifeGraphContext } from "../life-graph-context";
import { DrizzleProjectRepository } from "../repositories/drizzle-project.repository";
import { titlesLikelyMatch } from "./title-similarity";

export interface FindOrCreateProjectInput {
  title: string;
  domain?: LifeDomainType;
}

/**
 * Usado por la extracción desde conversación (`extract-life-entities.ts`)
 * — mismo criterio de deduplicación por título que `find-or-create-goal.ts`.
 * Un Project creado por esta vía siempre nace en estado `"planning"`, sin
 * vincular a ningún Goal (esa vinculación es una decisión de producto
 * aparte, no algo que la extracción automática deba inferir).
 */
export async function findOrCreateProject(
  db: Database,
  context: LifeGraphContext,
  input: FindOrCreateProjectInput,
): Promise<Project> {
  const repository = new DrizzleProjectRepository(db);
  const existingProjects = await repository.list(context);
  const match = existingProjects.find((project) =>
    titlesLikelyMatch(project.title, input.title),
  );

  if (match) {
    return match;
  }

  return repository.create(context, {
    goalId: undefined,
    title: input.title,
    description: undefined,
    status: "planning",
    domain: input.domain,
    startDate: undefined,
    dueDate: undefined,
  });
}
