import type { Database } from "../../db/client";
import type { Habit } from "../entities/habit";
import type { LifeGraphContext } from "../life-graph-context";
import { DrizzleHabitRepository } from "../repositories/drizzle-habit.repository";

/** Hábitos declarados que siguen activos — lo que consume Reality Snapshot (`life.activeHabits`). */
export async function listActiveHabits(
  db: Database,
  context: LifeGraphContext,
): Promise<Habit[]> {
  const habits = await new DrizzleHabitRepository(db).list(context);

  return habits.filter((habit) => habit.active);
}
