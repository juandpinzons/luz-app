import type { Database } from "../../db/client";
import type { Goal } from "../entities/goal";
import type { LifeGraphContext } from "../life-graph-context";
import { DrizzleGoalRepository } from "../repositories/drizzle-goal.repository";

/**
 * Objetivos que todavía están en curso — lo que consume Reality
 * Snapshot (`life.activeGoals`). Filtro resuelto en SQL
 * (`DrizzleGoalRepository.listActive`), no en JS -- evita hidratar
 * objetivos ya completados/abandonados (que solo crecen con el tiempo)
 * en cada turno de conversación (auditoría de rendimiento, Fase I
 * "Graph Performance").
 */
export async function listActiveGoals(
  db: Database,
  context: LifeGraphContext,
): Promise<Goal[]> {
  return new DrizzleGoalRepository(db).listActive(context);
}
