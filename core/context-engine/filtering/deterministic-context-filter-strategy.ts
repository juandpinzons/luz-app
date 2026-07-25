import type { LifeGraphContext } from "../../life/life-graph-context";
import type { RealitySnapshot } from "../../reality/reality-snapshot";
import type { ContextItem } from "../entities/context";
import type { ContextFilterStrategy } from "./context-filter-strategy";

function hasContent(label: string): boolean {
  return label.trim().length > 0;
}

/**
 * Primera implementación real de `ContextFilterStrategy` — traduce las
 * cuatro secciones de `RealitySnapshot` (life/memory/insights/signals)
 * a candidatos `ContextItem`, sin decidir todavía qué tan relevante es
 * cada uno (eso es `ContextScoringStrategy`). "Claramente no aplica
 * ahora mismo" ya se resolvió aguas arriba para memory/insights
 * (`assembleRealitySnapshot` solo entrega memorias con señal real y
 * insights validados) y para life (`listActiveGoals`/`listActiveProjects`/
 * `listActiveHabits` solo entregan lo activo) — lo único que queda por
 * descartar aquí es contenido vacío, la única forma de "no aplica" que
 * `RealitySnapshot` no puede garantizar por construcción (p. ej. una
 * señal externa con `content` en blanco).
 */
export class DeterministicContextFilterStrategy implements ContextFilterStrategy {
  async filter(
    snapshot: RealitySnapshot,
    _context: LifeGraphContext,
  ): Promise<ContextItem[]> {
    const candidates: ContextItem[] = [
      ...snapshot.life.activeGoals.map((item) => ({
        sourceId: item.id,
        source: "life" as const,
        label: item.title,
        dueDate: item.dueDate,
        relevanceScore: 0,
      })),
      ...snapshot.life.activeProjects.map((item) => ({
        sourceId: item.id,
        source: "life" as const,
        label: item.title,
        dueDate: item.dueDate,
        relevanceScore: 0,
      })),
      ...snapshot.life.activeHabits.map((item) => ({
        sourceId: item.id,
        source: "life" as const,
        label: item.title,
        dueDate: item.dueDate,
        relevanceScore: 0,
      })),
      ...snapshot.memory.items.map((item) => ({
        sourceId: item.id,
        source: "memory" as const,
        label: item.content,
        relevanceScore: 0,
      })),
      ...snapshot.insights.items.map((item) => ({
        sourceId: item.id,
        source: "insight" as const,
        label: item.description,
        relevanceScore: 0,
      })),
      // Sin id propio (`ExternalSignal`, `core/reality`) — `sourceId`
      // queda `undefined`, tal como documenta `ContextItem`.
      ...snapshot.signals.signals.map((signal) => ({
        source: "signal" as const,
        label: signal.content,
        relevanceScore: 0,
      })),
    ];

    return candidates.filter((item) => hasContent(item.label));
  }
}
