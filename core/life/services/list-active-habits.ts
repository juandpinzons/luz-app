import type { Database } from "../../db/client";
import type { Habit } from "../entities/habit";
import type { LifeGraphContext } from "../life-graph-context";
import { DrizzleHabitRepository } from "../repositories/drizzle-habit.repository";

/**
 * Hábitos declarados que siguen activos — lo que consume Reality
 * Snapshot (`life.activeHabits`). Filtro resuelto en SQL
 * (`DrizzleHabitRepository.listActive`), no en JS -- mismo criterio que
 * `listActiveGoals` (auditoría de rendimiento, Fase I "Graph
 * Performance").
 */
export async function listActiveHabits(
  db: Database,
  context: LifeGraphContext,
): Promise<Habit[]> {
  return new DrizzleHabitRepository(db).listActive(context);
}
