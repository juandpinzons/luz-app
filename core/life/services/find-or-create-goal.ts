import type { Database } from "../../db/client";
import type { Goal } from "../entities/goal";
import type { LifeDomainType } from "../value-objects/life-domain-type";
import type { LifeGraphContext } from "../life-graph-context";
import { DrizzleGoalRepository } from "../repositories/drizzle-goal.repository";
import { titlesLikelyMatch } from "./title-similarity";

export interface FindOrCreateGoalInput {
  title: string;
  domain?: LifeDomainType;
}

/**
 * Usado por `life-capture-service.ts` (disparado por Memory Engine)
 * — nunca crea un Goal nuevo si ya existe uno con un título similar,
 * para que declarar el mismo objetivo en dos conversaciones distintas
 * no produzca dos filas. Un Goal creado por esta vía siempre nace en
 * estado `"active"`.
 */
export async function findOrCreateGoal(
  db: Database,
  context: LifeGraphContext,
  input: FindOrCreateGoalInput,
): Promise<Goal> {
  const repository = new DrizzleGoalRepository(db);
  const existingGoals = await repository.list(context);
  const match = existingGoals.find((goal) =>
    titlesLikelyMatch(goal.title, input.title),
  );

  if (match) {
    return match;
  }

  return repository.create(context, {
    title: input.title,
    description: undefined,
    status: "active",
    domain: input.domain,
    targetDate: undefined,
  });
}
