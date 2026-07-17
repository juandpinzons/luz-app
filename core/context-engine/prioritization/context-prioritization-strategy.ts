import type { LifeGraphContext } from "../../life/life-graph-context";
import type { ContextItem } from "../entities/context";

/**
 * Última etapa: ordena (y opcionalmente recorta) los candidatos ya
 * puntuados en la lista final de `Context.items`. Separada de Score a
 * propósito — puntuar "qué tan relevante es esto" y decidir "cuánto de
 * esto mostrar ahora" son decisiones distintas, intercambiables por
 * separado.
 */
export interface ContextPrioritizationStrategy {
  prioritize(
    items: ContextItem[],
    context: LifeGraphContext,
  ): Promise<ContextItem[]>;
}
