import type { Database } from "../../../core/db/client";
import { DrizzleInsightRepository } from "../../../core/knowledge-engine";
import type { LifeGraphContext } from "../../../core/life";
import { explainInsight, type InsightExplanation } from "./explain-insight";

const DEFAULT_LIMIT = 5;

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
): Promise<InsightExplanation[]> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const insightRepository = new DrizzleInsightRepository(db);

  const insights = (await insightRepository.list(context))
    .filter((insight) => insight.status === "validated")
    .sort(
      (a, b) =>
        (b.validatedAt ?? b.createdAt).getTime() -
        (a.validatedAt ?? a.createdAt).getTime(),
    )
    .slice(0, limit);

  const explanations = await Promise.all(
    insights.map((insight) => explainInsight(db, context, insight.id)),
  );

  // `explainInsight` solo devuelve `null` si el insight no existe o no
  // está validado -- ninguno de los dos puede pasar aquí (venimos de
  // `insightRepository.list()` filtrado a `validated` un instante
  // antes), pero se filtra de todas formas en vez de asumirlo.
  return explanations.filter((explanation): explanation is InsightExplanation => explanation !== null);
}
