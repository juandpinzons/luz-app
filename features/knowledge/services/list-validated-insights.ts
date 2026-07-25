import type { Database } from "../../../core/db/client";
import { DrizzleInsightRepository } from "../../../core/knowledge-engine";
import type { EntityId, LifeGraphContext } from "../../../core/life";
import { DrizzleMemoryRepository } from "../../../core/memory-engine";

const DEFAULT_LIMIT = 5;

export interface InsightWithEvidence {
  id: EntityId;
  description: string;
  /** Contenido de las memorias que sustentan este insight (`Evidence`, ya real) -- nunca inventado, siempre trazable a algo que la persona ya contó. */
  evidenceContents: string[];
}

/**
 * Insights ya validados por Knowledge Engine, con su evidencia
 * resuelta -- la primera vez que esa comprensión acumulada se vuelve
 * visible en algún lugar del producto (antes solo alimentaba, de forma
 * anónima, la línea de continuidad del Dashboard). Nunca `type` ni
 * `confidence` expuestos: mismo criterio que `MemoryCard` ya estableció
 * para `memory.type` -- es taxonomía interna del engine, no algo que la
 * persona necesita leer para confiar en lo que dice. Solo
 * `status === "validated"`: `proposed`/`rejected` son estados internos
 * del pipeline (Validate ya decidió esto; esta función no vuelve a
 * decidirlo, Principio 3 de explicabilidad).
 */
export async function listValidatedInsights(
  db: Database,
  context: LifeGraphContext,
  options: { limit?: number } = {},
): Promise<InsightWithEvidence[]> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const insightRepository = new DrizzleInsightRepository(db);
  const memoryRepository = new DrizzleMemoryRepository(db);

  const insights = (await insightRepository.list(context))
    .filter((insight) => insight.status === "validated")
    .sort(
      (a, b) =>
        (b.validatedAt ?? b.createdAt).getTime() -
        (a.validatedAt ?? a.createdAt).getTime(),
    )
    .slice(0, limit);

  return Promise.all(
    insights.map(async (insight) => {
      const evidence = await insightRepository.getEvidence(context, insight.id);
      const contents = await Promise.all(
        evidence.map(async (item) => {
          const memory = await memoryRepository.getById(context, item.memoryId);
          return memory?.content;
        }),
      );

      return {
        id: insight.id,
        description: insight.description,
        evidenceContents: contents.filter((content): content is string => Boolean(content)),
      };
    }),
  );
}
