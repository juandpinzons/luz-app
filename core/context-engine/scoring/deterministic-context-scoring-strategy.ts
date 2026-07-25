import type { LifeGraphContext } from "../../life/life-graph-context";
import type { ContextItem } from "../entities/context";
import type { ContextItemSource } from "../value-objects/context-item-source";
import type { ContextScoringStrategy } from "./context-scoring-strategy";

/**
 * Peso base por fuente — el punto de partida antes de cualquier bono,
 * no el score final. Refleja qué tan comprimido es el conocimiento de
 * cada fuente: un insight ya es una interpretación de varias memorias
 * relacionadas ("qué significa"), más valioso por default que una
 * memoria puntual ("qué pasó"); el estado de vida (goals/projects/
 * habits) es contexto estructural permanente, no específico a este
 * mensaje, así que arranca más bajo; las señales externas (Connectors,
 * ADR-0015) no existen todavía en la práctica, así que su peso es el
 * más bajo por default hasta que haya evidencia real de qué tan
 * confiables son.
 */
const SOURCE_BASE_WEIGHT: Record<ContextItemSource, number> = {
  insight: 70,
  memory: 60,
  life: 45,
  signal: 30,
};

/**
 * Cuánto puede sumar la posición dentro de su propia fuente — solo
 * aplica a fuentes cuyo orden de entrada ya es un ranking real:
 * `memory` (rank de Memory Engine, descendente) e `insight` (confianza
 * de Knowledge Engine, descendente) — ver `assembleRealitySnapshot`.
 * `signal` se trata igual por si algún Connector futuro entrega
 * señales ya ordenadas por relevancia. `life` queda en 0 a propósito:
 * `listActiveGoals`/`listActiveProjects`/`listActiveHabits` no ordenan
 * por relevancia, solo por lo que devuelva la base de datos, así que
 * su posición no es señal real — usa `URGENCY_BONUS_MAX` en su lugar.
 */
const POSITION_BONUS_MAX: Record<ContextItemSource, number> = {
  insight: 20,
  memory: 20,
  life: 0,
  signal: 10,
};

/** Cuánto puede sumar la proximidad a `dueDate` — solo `life` la trae hoy (`ContextItem.dueDate`). */
const URGENCY_BONUS_MAX = 30;

/** A partir de cuántos días de anticipación un `dueDate` deja de sumar urgencia. */
const URGENCY_WINDOW_DAYS = 30;

const MAX_SCORE = 100;

/** Primero de su fuente = bono completo, último = 0, lineal entre ambos. */
function positionBonus(index: number, total: number, max: number): number {
  if (max === 0 || total <= 1) {
    return max;
  }
  return max * (1 - index / (total - 1));
}

/** Vencido o vence hoy = bono completo; a `URGENCY_WINDOW_DAYS` o más de distancia = 0; lineal entre ambos. */
function urgencyBonus(dueDate: Date | undefined, now: Date): number {
  if (!dueDate) {
    return 0;
  }
  const daysUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntilDue <= 0) {
    return URGENCY_BONUS_MAX;
  }
  if (daysUntilDue >= URGENCY_WINDOW_DAYS) {
    return 0;
  }
  return URGENCY_BONUS_MAX * (1 - daysUntilDue / URGENCY_WINDOW_DAYS);
}

/**
 * Única implementación real de `ContextScoringStrategy` — determinista,
 * sin IA, mismo criterio que `DeterministicMemoryRankingStrategy`
 * (`core/memory-engine/ranking`) y las estrategias de
 * `core/knowledge-engine/validation`: cada fuente ya resolvió su
 * propio ranking interno (Memory Engine, Knowledge Engine); lo que le
 * faltaba al sistema era poder comparar ESO entre fuentes distintas —
 * decidir si el insight más fuerte de hoy importa más que la memoria
 * más fuerte de hoy, o que un goal que vence mañana. Esa es la única
 * responsabilidad de esta estrategia — nunca vuelve a rankear dentro
 * de una misma fuente, eso ya lo hizo quien la produjo.
 */
export class DeterministicContextScoringStrategy implements ContextScoringStrategy {
  async score(
    items: ContextItem[],
    _context: LifeGraphContext,
  ): Promise<ContextItem[]> {
    const totalsBySource = new Map<ContextItemSource, number>();
    for (const item of items) {
      totalsBySource.set(item.source, (totalsBySource.get(item.source) ?? 0) + 1);
    }

    const seenBySource = new Map<ContextItemSource, number>();
    const now = new Date();

    return items.map((item) => {
      const index = seenBySource.get(item.source) ?? 0;
      seenBySource.set(item.source, index + 1);
      const total = totalsBySource.get(item.source) ?? 1;

      const score =
        SOURCE_BASE_WEIGHT[item.source] +
        positionBonus(index, total, POSITION_BONUS_MAX[item.source]) +
        urgencyBonus(item.dueDate, now);

      return { ...item, relevanceScore: Math.max(0, Math.min(MAX_SCORE, score)) };
    });
  }
}
