import type { Database } from "../../../core/db/client";
import {
  type Habit,
  type LifeGraphContext,
  DrizzleHabitRepository,
} from "../../../core/life";

/** Todos los Habits del LifeGraph, sin filtrar por `active` — ver list-all-goals.ts. */
export async function listAllHabits(
  db: Database,
  context: LifeGraphContext,
): Promise<Habit[]> {
  return new DrizzleHabitRepository(db).list(context);
}
