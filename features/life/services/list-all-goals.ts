import type { Database } from "../../../core/db/client";
import {
  type Goal,
  type LifeGraphContext,
  DrizzleGoalRepository,
} from "../../../core/life";

/** Todos los Goals del LifeGraph, sin filtrar por estado — a diferencia de `listActiveGoals` (core/life), esta es la lectura completa que necesita la pantalla Life (Sprint 3). */
export async function listAllGoals(
  db: Database,
  context: LifeGraphContext,
): Promise<Goal[]> {
  return new DrizzleGoalRepository(db).list(context);
}
