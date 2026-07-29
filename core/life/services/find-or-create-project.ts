import { sql } from "drizzle-orm";
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
 * Usado por `life-capture-service.ts` (disparado por Memory Engine)
 * — mismo criterio de deduplicación por título que `find-or-create-goal.ts`.
 * Un Project creado por esta vía siempre nace en estado `"planning"`, sin
 * vincular a ningún Goal (esa vinculación es una decisión de producto
 * aparte, no algo que la extracción automática deba inferir).
 *
 * War Room 2026-07-29: mismo hallazgo de concurrencia y misma solución
 * que `find-or-create-goal.ts` -- ver ese docblock.
 */
export async function findOrCreateProject(
  db: Database,
  context: LifeGraphContext,
  input: FindOrCreateProjectInput,
): Promise<Project> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.lifeGraphId} || ':project'))`,
    );

    const repository = new DrizzleProjectRepository(tx);
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
  });
}
