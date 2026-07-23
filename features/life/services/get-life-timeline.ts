import type { Database } from "../../../core/db/client";
import type { LifeGraphContext } from "../../../core/life";
import { DrizzleMemoryRepository, type Memory } from "../../../core/memory-engine";

const DEFAULT_LIMIT = 15;

/**
 * Timeline de Life: cronológico, construido a partir de Memoria
 * (`occurredAt`), no de `LifeEvent` — no persiste todavía
 * (docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md §3.2). Solo memorias
 * `active`; ordenadas por `occurredAt` (o `createdAt` si no hay fecha
 * de ocurrencia), más recientes primero.
 */
export async function getLifeTimeline(
  db: Database,
  context: LifeGraphContext,
  options: { limit?: number } = {},
): Promise<Memory[]> {
  const memories = await new DrizzleMemoryRepository(db).list(context);

  return memories
    .filter((memory) => memory.status === "active")
    .sort(
      (a, b) =>
        (b.occurredAt ?? b.createdAt).getTime() -
        (a.occurredAt ?? a.createdAt).getTime(),
    )
    .slice(0, options.limit ?? DEFAULT_LIMIT);
}
