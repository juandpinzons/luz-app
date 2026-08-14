import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../../../core/db/client";
import { memories } from "../../../core/db/schema";
import type { LifeGraphContext } from "../../../core/life";

export interface RecentMemoryHighlight {
  content: string;
  createdAt: Date;
}

/**
 * La memoria activa más recién CAPTURADA (`createdAt`), no la más
 * reciente en el tiempo del recuerdo (`occurredAt`) -- a propósito,
 * distinto del resto de las lecturas de memoria
 * (`features/memories/services/search-memories.ts`,
 * `features/life/services/get-life-timeline.ts`), que ordenan por
 * `occurredAt` porque son pantallas cronológicas de "cuándo pasó en tu
 * vida". Esto es un teaser de "qué acaba de entender LUZ de ti" --
 * inequívocamente un concepto de `createdAt`: una memoria sobre algo
 * que pasó hace un mes pero que LUZ capturó recién hoy debe aparecer
 * aquí como lo último, nunca enterrada como si fuera de hace un mes.
 */
export async function getRecentMemoryHighlight(
  db: Database,
  context: LifeGraphContext,
): Promise<RecentMemoryHighlight | null> {
  const [row] = await db
    .select({ content: memories.content, createdAt: memories.createdAt })
    .from(memories)
    .where(
      and(
        eq(memories.lifeGraphId, context.lifeGraphId),
        eq(memories.status, "active"),
        eq(memories.suppressed, false),
      ),
    )
    .orderBy(desc(memories.createdAt))
    .limit(1);

  return row ?? null;
}
