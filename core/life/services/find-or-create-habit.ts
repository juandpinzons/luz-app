import type { Database } from "../../db/client";
import type { Habit } from "../entities/habit";
import type { LifeDomainType } from "../value-objects/life-domain-type";
import type { LifeGraphContext } from "../life-graph-context";
import { DrizzleHabitRepository } from "../repositories/drizzle-habit.repository";
import { titlesLikelyMatch } from "./title-similarity";

export interface FindOrCreateHabitInput {
  title: string;
  domain?: LifeDomainType;
}

/**
 * Usado por `life-capture-service.ts` (disparado por Memory Engine)
 * — mismo criterio de deduplicación por título que `find-or-create-goal.ts`.
 * Un Habit creado por esta vía siempre nace `active: true`.
 */
export async function findOrCreateHabit(
  db: Database,
  context: LifeGraphContext,
  input: FindOrCreateHabitInput,
): Promise<Habit> {
  const repository = new DrizzleHabitRepository(db);
  const existingHabits = await repository.list(context);
  const match = existingHabits.find((habit) =>
    titlesLikelyMatch(habit.title, input.title),
  );

  if (match) {
    return match;
  }

  return repository.create(context, {
    goalId: undefined,
    title: input.title,
    description: undefined,
    domain: input.domain,
    active: true,
  });
}
