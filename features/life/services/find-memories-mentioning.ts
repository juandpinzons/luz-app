import type { Database } from "../../../core/db/client";
import type { LifeGraphContext } from "../../../core/life";
import { createMemoryEngine, type Memory } from "../../../core/memory-engine";

const DEFAULT_LIMIT = 10;

/**
 * Memorias que mencionan literalmente el título de una entidad de Life
 * (docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md §3.2.1) — búsqueda de
 * texto real (`StructuredMemoryRetrievalStrategy`, ya usada por el
 * chat), nunca un vínculo semántico. Una memoria sobre el mismo tema
 * que no use esta palabra exacta no aparece aquí; es el límite
 * declarado explícitamente, no un descuido.
 */
export async function findMemoriesMentioning(
  db: Database,
  context: LifeGraphContext,
  options: { title: string; limit?: number },
): Promise<Memory[]> {
  return createMemoryEngine(db).retrieve(context, {
    text: options.title,
    limit: options.limit ?? DEFAULT_LIMIT,
  });
}
