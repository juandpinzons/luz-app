import type { Database } from "../../../core/db/client";
import { DrizzleInsightRepository, INSIGHT_TYPES, type Insight, type InsightType } from "../../../core/knowledge-engine";
import type { LifeGraphContext } from "../../../core/life";
import { explainInsight, type InsightExplanation } from "./explain-insight";

const DEFAULT_LIMIT = 5;

export interface ValidatedInsights {
  /** Los más recientes, ya explicados y recortados a `limit` -- para mostrar tal cual. */
  items: InsightExplanation[];
  /**
   * Cuántos insights `validated` existen EN TOTAL, no solo los que
   * caben en `items` -- `items.length` (el tope de esta función)
   * nunca debe usarse como "cuánto entendió LUZ de ti": dos cuentas
   * con más actividad que el tope mostrarían el mismo número (bug
   * real, encontrado en producción -- dos usuarias distintas veían
   * "5" idéntico).
   */
  total: number;
  /** Desglose real por `Insight.type` sobre el TOTAL (no solo sobre `items`). */
  byType: Partial<Record<InsightType, number>>;
}

function countByType(insights: readonly Insight[]): Partial<Record<InsightType, number>> {
  const counts: Partial<Record<InsightType, number>> = {};
  for (const insight of insights) {
    counts[insight.type] = (counts[insight.type] ?? 0) + 1;
  }
  return Object.fromEntries(INSIGHT_TYPES.filter((type) => counts[type]).map((type) => [type, counts[type]]));
}

/**
 * Los insights ya validados más recientes, cada uno ya explicado
 * (`explainInsight`) -- nunca vuelve a resolver evidencia por su
 * cuenta, para no mantener dos caminos que hacen lo mismo. Solo decide
 * el orden y el límite; toda la explicación (evidencia, recencia,
 * consistencia) es responsabilidad exclusiva de `explainInsight`.
 */
export async function listValidatedInsights(
  db: Database,
  context: LifeGraphContext,
  options: { limit?: number } = {},
): Promise<ValidatedInsights> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const insightRepository = new DrizzleInsightRepository(db);

  const validated = (await insightRepository.list(context)).filter(
    (insight) => insight.status === "validated",
  );

  const sorted = [...validated].sort(
    (a, b) =>
      (b.validatedAt ?? b.createdAt).getTime() -
      (a.validatedAt ?? a.createdAt).getTime(),
  );

  const explanations = await Promise.all(
    sorted.slice(0, limit).map((insight) => explainInsight(db, context, insight.id)),
  );

  // `explainInsight` solo devuelve `null` si el insight no existe o no
  // está validado -- ninguno de los dos puede pasar aquí (venimos de
  // `insightRepository.list()` filtrado a `validated` un instante
  // antes), pero se filtra de todas formas en vez de asumirlo.
  const items = explanations.filter((explanation): explanation is InsightExplanation => explanation !== null);

  return {
    items,
    total: validated.length,
    byType: countByType(validated),
  };
}
