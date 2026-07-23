import type { Database } from "../../../core/db/client";
import type { LifeGraphContext } from "../../../core/life";
import {
  createMemoryEngine,
  DrizzleMemoryRepository,
  type Memory,
} from "../../../core/memory-engine";

const RESULT_CAP = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

export type MemoryTimeGroupLabel = "Hoy" | "Esta semana" | "Este mes" | "Más atrás";

export interface MemoryWithConnections extends Memory {
  /** Contenido de las memorias conectadas (`MemoryConnection`, ya real) — solo las que están dentro del mismo resultado; ver nota en searchMemories. */
  connectedContents: string[];
}

export interface MemoryTimeGroup {
  label: MemoryTimeGroupLabel;
  memories: MemoryWithConnections[];
}

function groupLabel(date: Date): MemoryTimeGroupLabel {
  const diffDays = Math.floor((Date.now() - date.getTime()) / DAY_MS);
  if (diffDays <= 0) return "Hoy";
  if (diffDays <= 7) return "Esta semana";
  if (diffDays <= 30) return "Este mes";
  return "Más atrás";
}

function sortByRecency<T extends Memory>(memories: T[]): T[] {
  return [...memories].sort(
    (a, b) =>
      (b.occurredAt ?? b.createdAt).getTime() -
      (a.occurredAt ?? a.createdAt).getTime(),
  );
}

function groupByTimeLabel(memories: MemoryWithConnections[]): MemoryTimeGroup[] {
  const buckets = new Map<MemoryTimeGroupLabel, MemoryWithConnections[]>();
  for (const memory of memories) {
    const label = groupLabel(memory.occurredAt ?? memory.createdAt);
    const bucket = buckets.get(label) ?? [];
    bucket.push(memory);
    buckets.set(label, bucket);
  }

  const order: MemoryTimeGroupLabel[] = ["Hoy", "Esta semana", "Este mes", "Más atrás"];
  return order
    .filter((label) => buckets.has(label))
    .map((label) => ({ label, memories: buckets.get(label) as MemoryWithConnections[] }));
}

/**
 * Memorias de Memories (Sprint 4, docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md
 * §3.3): con `text`, reutiliza `StructuredMemoryRetrievalStrategy` (ya
 * real, mismo mecanismo que el chat) — sin `text`, `MemoryRepository.list`
 * filtrado a `active`. Se reordena por `occurredAt` (nunca por rank)
 * porque esta pantalla es cronológica, no de relevancia — y, si se
 * pide, se agrupa por Hoy/Esta semana/Este mes/Más atrás.
 *
 * `connectedContents` se resuelve contra el mismo lote ya cargado
 * (`MemoryConnection`, ya real) — si la memoria conectada quedó fuera
 * (p. ej. un `text` que la filtró, o el cap de 100), esa conexión no
 * se muestra en vez de disparar una consulta adicional; es el límite
 * más pequeño posible, no un olvido.
 */
export async function searchMemories(
  db: Database,
  context: LifeGraphContext,
  options: { text?: string; groupByTime: true },
): Promise<MemoryTimeGroup[]>;
export async function searchMemories(
  db: Database,
  context: LifeGraphContext,
  options?: { text?: string; groupByTime?: false },
): Promise<MemoryWithConnections[]>;
export async function searchMemories(
  db: Database,
  context: LifeGraphContext,
  options: { text?: string; groupByTime?: boolean } = {},
): Promise<MemoryWithConnections[] | MemoryTimeGroup[]> {
  const repository = new DrizzleMemoryRepository(db);

  const raw = options.text
    ? await createMemoryEngine(db).retrieve(context, {
        text: options.text,
        limit: RESULT_CAP,
      })
    : (await repository.list(context)).filter(
        (memory) => memory.status === "active",
      );

  const sorted = sortByRecency(raw).slice(0, RESULT_CAP);
  const contentById = new Map(sorted.map((memory) => [memory.id, memory.content]));

  const enriched: MemoryWithConnections[] = await Promise.all(
    sorted.map(async (memory) => {
      const connections = await repository.getConnections(context, memory.id);
      const connectedContents = connections
        .map((connection) =>
          contentById.get(
            connection.fromMemoryId === memory.id
              ? connection.toMemoryId
              : connection.fromMemoryId,
          ),
        )
        .filter((content): content is string => Boolean(content));

      return { ...memory, connectedContents };
    }),
  );

  return options.groupByTime ? groupByTimeLabel(enriched) : enriched;
}
