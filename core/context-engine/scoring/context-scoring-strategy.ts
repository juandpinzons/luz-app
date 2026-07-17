import type { LifeGraphContext } from "../../life/life-graph-context";
import type { ContextItem } from "../entities/context";

/**
 * Asigna `relevanceScore` a cada candidato filtrado. Patrón estrategia:
 * recencia, proximidad a un deadline, señales explícitas del usuario,
 * etc. son enfoques intercambiables — ninguna implementación concreta
 * existe todavía.
 */
export interface ContextScoringStrategy {
  score(
    items: ContextItem[],
    context: LifeGraphContext,
  ): Promise<ContextItem[]>;
}
