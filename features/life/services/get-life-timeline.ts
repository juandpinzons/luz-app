import type { Database } from "../../../core/db/client";
import type { LifeGraphContext } from "../../../core/life";
import { DrizzleMemoryRepository, MEMORY_TYPES, type Memory, type MemoryType } from "../../../core/memory-engine";

const DEFAULT_LIMIT = 15;

export interface LifeTimeline {
  /** Las más recientes, ya recortadas a `limit` -- para mostrar tal cual. */
  items: Memory[];
  /**
   * Cuántas memorias `active` existen EN TOTAL, no solo las que caben
   * en `items` -- `items.length` (¿5? ¿15?, el tope de esta función)
   * nunca debe usarse como "cuánto te conozco": dos cuentas con más
   * actividad que el tope mostrarían el mismo número, aunque tengan
   * cantidades reales muy distintas (bug real, encontrado en
   * producción -- dos usuarias distintas veían "15" idéntico).
   */
  total: number;
  /** Desglose real por `Memory.type` sobre el TOTAL (no solo sobre `items`) -- la categorización que faltaba para que esto se sienta específico de cada persona, no un número plano. */
  byType: Partial<Record<MemoryType, number>>;
}

function countByType(memories: readonly Memory[]): Partial<Record<MemoryType, number>> {
  const counts: Partial<Record<MemoryType, number>> = {};
  for (const memory of memories) {
    counts[memory.type] = (counts[memory.type] ?? 0) + 1;
  }
  // Orden estable (el mismo de `MEMORY_TYPES`) -- nunca el orden de inserción, que dependería de qué tipo apareció primero en esta cuenta.
  return Object.fromEntries(MEMORY_TYPES.filter((type) => counts[type]).map((type) => [type, counts[type]]));
}

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
): Promise<LifeTimeline> {
  const memories = await new DrizzleMemoryRepository(db).list(context);
  const active = memories.filter(
    (memory) => memory.status === "active" && !memory.suppressed && !memory.hiddenFromUser,
  );

  const sorted = [...active].sort(
    (a, b) =>
      (b.occurredAt ?? b.createdAt).getTime() -
      (a.occurredAt ?? a.createdAt).getTime(),
  );

  return {
    items: sorted.slice(0, options.limit ?? DEFAULT_LIMIT),
    total: active.length,
    byType: countByType(active),
  };
}
