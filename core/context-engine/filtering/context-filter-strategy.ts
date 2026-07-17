import type { LifeGraphContext } from "../../life/life-graph-context";
import type { RealitySnapshot } from "../../reality/reality-snapshot";
import type { ContextItem } from "../entities/context";

/**
 * Primera etapa: traduce un `RealitySnapshot` (life + memory + signals)
 * a candidatos `ContextItem`, descartando lo que claramente no aplica
 * ahora mismo (p. ej. un goal completado). Patrón estrategia — qué
 * cuenta como "claramente no aplica" es intercambiable, ninguna
 * implementación concreta existe todavía.
 */
export interface ContextFilterStrategy {
  filter(
    snapshot: RealitySnapshot,
    context: LifeGraphContext,
  ): Promise<ContextItem[]>;
}
