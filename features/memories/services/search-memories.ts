import { and, eq, inArray, or, sql } from "drizzle-orm";
import { personCalendarStartOfDayUtc } from "../../../core/config/person-time-zone";
import type { Database } from "../../../core/db/client";
import { memories, memoryConnections } from "../../../core/db/schema";
import type { LifeGraphContext } from "../../../core/life";
import { createMemoryEngine, type Memory } from "../../../core/memory-engine";
import { createEntityId, type EntityId } from "../../../core/life/value-objects/entity-id";
import { decryptContent } from "../../../core/security/content-cipher";

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

/** Exportado para `select-memory-highlights.ts` -- la vista "ver todo" agrupa el mismo lote ya cargado, nunca una segunda consulta. */
export function groupByTimeLabel(memories: MemoryWithConnections[]): MemoryTimeGroup[] {
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
 * War Room 2026-07-29 (continuación): el camino sin `text` llamaba a
 * `MemoryRepository.list()` -- sin límite, sin filtro de `status` en
 * SQL (se filtraba después, en JS) -- la única lectura de todo el
 * repo sin ningún techo, ni siquiera de seguridad (a diferencia de
 * `/conversations`, que ya tiene un `LIMIT 200`). Reemplazado por una
 * consulta local, directa a `memories` (mismo patrón que ya usa
 * `app/dashboard/page.tsx` para `conversations` -- leer un schema
 * directamente desde `features/` no es nuevo en este código base),
 * con `status = 'active'` y el orden real ya en SQL, acotada a
 * `RESULT_CAP`. Nunca se tocó `DrizzleMemoryRepository.list()` ni
 * `MemoryRepository` -- ese método sigue exactamente igual para sus
 * otros consumidores (`get-life-timeline.ts`, `DefaultConnectStage`).
 */
function toActiveMemory(row: {
  id: string;
  lifeGraphId: string;
  personId: string | null;
  type: Memory["type"];
  content: string;
  source: Memory["source"];
  sourceId: string | null;
  status: Memory["status"];
  suppressed: boolean;
  hiddenFromUser: boolean;
  rankScore: number | null;
  rankedAt: Date | null;
  occurredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Memory {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    personId: row.personId ? createEntityId(row.personId) : undefined,
    type: row.type,
    content: decryptContent(row.content),
    source: row.source,
    sourceId: row.sourceId ?? undefined,
    status: row.status,
    suppressed: row.suppressed,
    hiddenFromUser: row.hiddenFromUser,
    rank:
      row.rankScore !== null && row.rankedAt !== null
        ? { score: row.rankScore, rankedAt: row.rankedAt }
        : undefined,
    occurredAt: row.occurredAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * `visibility: "hidden"` (auditoría de arquitectura, 2026-08-16) --
 * la contraparte de "ocultar de mi vista": la única forma de volver a
 * ver, y por lo tanto poder deshacer (`?view=hidden` en
 * `/memories`), lo que la persona ya ocultó. Deliberadamente SOLO esta
 * consulta directa -- nunca combinado con `text` (la mitad de
 * recuperación compartida con el chat, `StructuredMemoryRetrievalStrategy`,
 * no distingue "esta lectura es para la persona" de "esta lectura es
 * para LUZ" en este alcance; ver plan). Buscar dentro de lo oculto
 * queda fuera de esta primera versión, no un olvido.
 */
async function listRecentActiveMemories(
  db: Database,
  context: LifeGraphContext,
  visibility: "visible" | "hidden" = "visible",
): Promise<Memory[]> {
  const rows = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.lifeGraphId, context.lifeGraphId),
        eq(memories.status, "active"),
        eq(memories.suppressed, false),
        eq(memories.hiddenFromUser, visibility === "hidden"),
      ),
    )
    .orderBy(sql`${memories.occurredAt} DESC NULLS LAST`, sql`${memories.createdAt} DESC`)
    .limit(RESULT_CAP);

  return rows.map(toActiveMemory);
}

/**
 * `?month=` en /memories (franja de meses, `get-memory-timeline-index.ts`)
 * -- misma forma que `listRecentActiveMemories` de arriba, acotada a
 * un mes calendario en hora Bogotá en vez de "las más recientes".
 * Límite superior exclusivo (inicio del mes siguiente) en vez de
 * "último instante del mes": evita errores de borde por segundos/
 * milisegundos y funciona igual para meses de 28, 30 o 31 días sin
 * lógica especial. Consulta directa, no pasa por
 * `StructuredMemoryRetrievalStrategy` -- mismo motivo que el resto de
 * este archivo: esta pantalla es cronológica, no de relevancia.
 */
async function listMemoriesForMonth(
  db: Database,
  context: LifeGraphContext,
  month: string,
): Promise<Memory[]> {
  const [year, monthNumber] = month.split("-").map(Number);
  const from = personCalendarStartOfDayUtc(year, monthNumber, 1);
  const to =
    monthNumber === 12
      ? personCalendarStartOfDayUtc(year + 1, 1, 1)
      : personCalendarStartOfDayUtc(year, monthNumber + 1, 1);

  const rows = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.lifeGraphId, context.lifeGraphId),
        eq(memories.status, "active"),
        eq(memories.suppressed, false),
        eq(memories.hiddenFromUser, false),
        // `.toISOString()` -- el driver de `postgres` no serializa un
        // `Date` crudo interpolado dentro de un fragmento `sql` (a
        // diferencia de pasarlo por `gte`/`lte` sobre una columna
        // tipada); confirmado corriendo esto contra Postgres real
        // (`ERR_INVALID_ARG_TYPE`). Un string ISO sí se parametriza
        // igual que cualquier otro valor.
        sql`coalesce(${memories.occurredAt}, ${memories.createdAt}) >= ${from.toISOString()}`,
        sql`coalesce(${memories.occurredAt}, ${memories.createdAt}) < ${to.toISOString()}`,
      ),
    )
    .orderBy(sql`${memories.occurredAt} DESC NULLS LAST`, sql`${memories.createdAt} DESC`)
    .limit(RESULT_CAP);

  return rows.map(toActiveMemory);
}

/**
 * War Room 2026-07-29 (continuación): antes, una consulta
 * `getConnections` por memoria (hasta `RESULT_CAP` = 100, paralelas
 * pero igual 100 round-trips). Una sola consulta agrupada por lote,
 * `IN (...)` en ambas direcciones -- mismo patrón ya usado en
 * `structured-memory-retrieval-strategy.ts` para contar conexiones,
 * aquí se necesitan las filas completas, no solo el conteo.
 */
async function loadConnectionsByMemoryId(
  db: Database,
  context: LifeGraphContext,
  candidateIds: EntityId[],
): Promise<Map<string, EntityId[]>> {
  if (candidateIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      fromMemoryId: memoryConnections.fromMemoryId,
      toMemoryId: memoryConnections.toMemoryId,
    })
    .from(memoryConnections)
    .where(
      and(
        eq(memoryConnections.lifeGraphId, context.lifeGraphId),
        or(
          inArray(memoryConnections.fromMemoryId, candidateIds),
          inArray(memoryConnections.toMemoryId, candidateIds),
        ),
      ),
    );

  const connectedIdsByMemoryId = new Map<string, EntityId[]>();
  const addEdge = (memoryId: string, otherId: string) => {
    const list = connectedIdsByMemoryId.get(memoryId) ?? [];
    list.push(createEntityId(otherId));
    connectedIdsByMemoryId.set(memoryId, list);
  };
  for (const row of rows) {
    addEdge(row.fromMemoryId, row.toMemoryId);
    addEdge(row.toMemoryId, row.fromMemoryId);
  }
  return connectedIdsByMemoryId;
}

/**
 * Memorias de Memories (Sprint 4, docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md
 * §3.3): con `text`, reutiliza `StructuredMemoryRetrievalStrategy` (ya
 * real, mismo mecanismo que el chat, ya acotada). Sin `text`,
 * `listRecentActiveMemories` (arriba) -- también acotada, nunca la
 * tabla completa. Se reordena por `occurredAt` (nunca por rank) porque
 * esta pantalla es cronológica, no de relevancia — y, si se pide, se
 * agrupa por Hoy/Esta semana/Este mes/Más atrás.
 *
 * `connectedContents` se resuelve contra el mismo lote ya cargado — si
 * la memoria conectada quedó fuera (p. ej. un `text` que la filtró, o
 * el cap de 100), esa conexión no se muestra en vez de disparar una
 * consulta adicional; es el límite más pequeño posible, no un olvido.
 */
export async function searchMemories(
  db: Database,
  context: LifeGraphContext,
  options: { text?: string; month?: string; groupByTime: true; visibility?: "visible" | "hidden" },
): Promise<MemoryTimeGroup[]>;
export async function searchMemories(
  db: Database,
  context: LifeGraphContext,
  options?: { text?: string; month?: string; groupByTime?: false; visibility?: "visible" | "hidden" },
): Promise<MemoryWithConnections[]>;
export async function searchMemories(
  db: Database,
  context: LifeGraphContext,
  options: { text?: string; month?: string; groupByTime?: boolean; visibility?: "visible" | "hidden" } = {},
): Promise<MemoryWithConnections[] | MemoryTimeGroup[]> {
  const visibility = options.visibility ?? "visible";
  // `visibility: "hidden"` nunca pasa por `text` ni por `month` (ver
  // docblock de `listRecentActiveMemories`) -- ambos se ignoran en ese
  // modo en vez de fallar, así un `?q=`/`?month=` que quede en la URL
  // al cambiar de pestaña no rompe la vista de ocultos. `month` gana
  // sobre `text` si ambos llegaran juntos -- no ocurre desde la UI
  // (son mutuamente excluyentes en `/memories`), pero mantiene la
  // resolución determinística si algún día pasara.
  const raw =
    options.month && visibility === "visible"
      ? await listMemoriesForMonth(db, context, options.month)
      : options.text && visibility === "visible"
        ? await createMemoryEngine(db).retrieve(context, {
            text: options.text,
            limit: RESULT_CAP,
          })
        : await listRecentActiveMemories(db, context, visibility);

  const sorted = sortByRecency(raw).slice(0, RESULT_CAP);
  const contentById = new Map(sorted.map((memory) => [memory.id, memory.content]));
  const connectedIdsByMemoryId = await loadConnectionsByMemoryId(
    db,
    context,
    sorted.map((memory) => memory.id),
  );

  const enriched: MemoryWithConnections[] = sorted.map((memory) => {
    const connectedContents = (connectedIdsByMemoryId.get(memory.id) ?? [])
      .map((otherId) => contentById.get(otherId))
      .filter((content): content is string => Boolean(content));

    return { ...memory, connectedContents };
  });

  return options.groupByTime ? groupByTimeLabel(enriched) : enriched;
}
