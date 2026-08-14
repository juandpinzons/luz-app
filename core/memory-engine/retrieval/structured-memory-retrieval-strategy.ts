import { and, count, eq, gte, ilike, inArray, lte, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { type MemoryRow, memories, memoryConnections } from "../../db/schema";
import type { LifeGraphContext } from "../../life/life-graph-context";
import { type EntityId, createEntityId } from "../../life/value-objects/entity-id";
import type { Memory } from "../entities/memory";
import type { MemoryQuery } from "./memory-query";
import type { MemoryRetrievalStrategy } from "./memory-retrieval-strategy";

const DEFAULT_LIMIT = 50;

/**
 * War Room 2026-07-29 (mejora de ranking de recuperación, dentro de
 * Memory Engine, sin tocar `MemoryRetrievalStrategy`/`MemoryQuery`):
 * antes de rankear por relevancia real se trae un pool más grande que
 * el límite pedido, ordenado por `rankScore` (el mismo filtro de
 * siempre, nunca se relaja) -- nunca la tabla completa, así que esto
 * no reintroduce el hallazgo de "consulta sin límite" ya documentado
 * para otras partes del sistema. 150 es un techo absoluto,
 * independiente de cuán grande sea `query.limit`.
 */
const CANDIDATE_POOL_MULTIPLIER = 3;
const CANDIDATE_POOL_CEILING = 150;

/**
 * Cuánto pesa cada conexión estructural (mismo origen o misma persona,
 * ver `DefaultConnectStage`) en el score de recuperación -- acotado
 * (`MAX_CONNECTION_BONUS`) para que ninguna cantidad de conexiones
 * pueda superar el salto entre dos niveles de `rankScore`
 * (15/45/65/80/90/100, ver `deterministic-memory-ranking-strategy.ts`)
 * -- mismo principio de "nunca cruza un nivel" que ya rige el bono de
 * recencia de esa estrategia, aplicado acá a un segundo factor.
 */
const CONNECTION_WEIGHT = 2;
const MAX_CONNECTION_BONUS = 10;

/** Mismo principio que el bono de recencia de `rank()`, pero recalculado en cada recuperación en vez de congelado al momento de capturar la memoria -- una memoria capturada hace un año con `rankScore` alto no debe leerse hoy como si acabara de pasar. */
const MAX_FRESH_RECENCY_BONUS_DAYS = 60;
const MAX_FRESH_RECENCY_BONUS = 5;

function toMemory(row: MemoryRow): Memory {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    personId: row.personId ? createEntityId(row.personId) : undefined,
    type: row.type,
    content: row.content,
    source: row.source,
    sourceId: row.sourceId ?? undefined,
    status: row.status,
    suppressed: row.suppressed,
    rank:
      row.rankScore !== null && row.rankedAt !== null
        ? { score: row.rankScore, rankedAt: row.rankedAt }
        : undefined,
    occurredAt: row.occurredAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function freshRecencyBonus(referenceDate: Date, now: Date): number {
  const ageDays = Math.max(
    0,
    (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const decayedUnits = Math.floor(
    (ageDays / MAX_FRESH_RECENCY_BONUS_DAYS) * MAX_FRESH_RECENCY_BONUS,
  );

  return Math.max(0, MAX_FRESH_RECENCY_BONUS - decayedUnits);
}

/**
 * Cuántas conexiones estructurales tiene cada memoria del pool
 * (`memory_connections`, ya calculadas por `DefaultConnectStage` en
 * cada captura -- esta estrategia es la primera en usarlas para decidir
 * qué recuperar, no solo para mostrarlas en `/memories`). Dos consultas
 * agregadas (`from`/`to`, la tabla no distingue dirección para este
 * propósito), nunca una consulta por memoria -- el pool ya está
 * acotado por `CANDIDATE_POOL_CEILING`, así que esto es exactamente
 * dos round-trips adicionales sin importar cuántas memorias tenga la
 * persona en total.
 */
async function countConnectionsByMemoryId(
  db: Database,
  candidateIds: EntityId[],
): Promise<Map<string, number>> {
  if (candidateIds.length === 0) {
    return new Map();
  }

  const [fromCounts, toCounts] = await Promise.all([
    db
      .select({ memoryId: memoryConnections.fromMemoryId, value: count() })
      .from(memoryConnections)
      .where(inArray(memoryConnections.fromMemoryId, candidateIds))
      .groupBy(memoryConnections.fromMemoryId),
    db
      .select({ memoryId: memoryConnections.toMemoryId, value: count() })
      .from(memoryConnections)
      .where(inArray(memoryConnections.toMemoryId, candidateIds))
      .groupBy(memoryConnections.toMemoryId),
  ]);

  const counts = new Map<string, number>();
  for (const row of [...fromCounts, ...toCounts]) {
    counts.set(row.memoryId, (counts.get(row.memoryId) ?? 0) + row.value);
  }
  return counts;
}

/**
 * Mitad "estructurada" de ADR-0004 (Hybrid Memory): filtros exactos
 * sobre `MemoryQuery`, sin embeddings. `query.text`, si viene, se
 * compara por coincidencia de texto (ILIKE) — no por significado; la
 * mitad semántica es una estrategia distinta, todavía no construida
 * (PR-020).
 *
 * Solo devuelve memorias `status: "active"`. "Qué es útil recuperar
 * ahora" excluye por definición lo archivado y lo olvidado —
 * `MemoryQuery` no expone un campo `status` a propósito: quien
 * necesite consultar memorias archivadas u olvidadas explícitamente
 * requiere un contrato nuevo, no algo que esta estrategia deba
 * inventar en silencio.
 *
 * War Room 2026-07-29: antes ordenaba solo por `rankScore` (congelado
 * al momento de capturar la memoria) con `createdAt` como desempate --
 * una memoria de hace un año con rank alto siempre ganaba sobre una
 * reciente y moderadamente importante, y las conexiones estructurales
 * que `DefaultConnectStage` ya calcula en cada captura nunca se usaban
 * para decidir qué recuperar. Ahora: `rankScore` sigue siendo el
 * factor dominante (retomar la comprensión real de la persona antes
 * que cualquier otra cosa, PR-014, intacto), refinado por cuántas
 * conexiones estructurales tiene cada memoria y por qué tan reciente
 * es *ahora*, no al momento de capturarla -- ninguno de los dos bonos
 * puede cruzar un nivel de `rankScore` (mismo principio que ya rige el
 * bono de recencia de captura). Memorias sin rank todavía calculado
 * se incluyen, solo al final -- nunca se descartan, igual que antes.
 */
export class StructuredMemoryRetrievalStrategy
  implements MemoryRetrievalStrategy
{
  constructor(private readonly db: Database) {}

  async retrieve(
    context: LifeGraphContext,
    query: MemoryQuery,
  ): Promise<Memory[]> {
    const conditions = [
      eq(memories.lifeGraphId, context.lifeGraphId),
      eq(memories.status, "active"),
      eq(memories.suppressed, false),
    ];

    if (query.type) {
      conditions.push(eq(memories.type, query.type));
    }
    if (query.personId) {
      conditions.push(eq(memories.personId, query.personId));
    }
    if (query.occurredAfter) {
      conditions.push(gte(memories.occurredAt, query.occurredAfter));
    }
    if (query.occurredBefore) {
      conditions.push(lte(memories.occurredAt, query.occurredBefore));
    }
    if (query.text) {
      conditions.push(ilike(memories.content, `%${query.text}%`));
    }

    const limit = query.limit ?? DEFAULT_LIMIT;
    const poolSize = Math.min(limit * CANDIDATE_POOL_MULTIPLIER, CANDIDATE_POOL_CEILING);

    const rows = await this.db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(sql`${memories.rankScore} DESC NULLS LAST`, sql`${memories.createdAt} DESC`)
      .limit(poolSize);

    const candidates = rows.map(toMemory);
    const connectionCounts = await countConnectionsByMemoryId(
      this.db,
      candidates.map((memory) => memory.id),
    );

    const now = new Date();
    const scored = candidates.map((memory) => {
      const connectionBonus = Math.min(
        (connectionCounts.get(memory.id) ?? 0) * CONNECTION_WEIGHT,
        MAX_CONNECTION_BONUS,
      );
      const recencyBonus = freshRecencyBonus(
        memory.occurredAt ?? memory.createdAt,
        now,
      );

      return {
        memory,
        compositeScore: (memory.rank?.score ?? 0) + connectionBonus + recencyBonus,
      };
    });

    scored.sort((a, b) => b.compositeScore - a.compositeScore);

    return scored.slice(0, limit).map((entry) => entry.memory);
  }
}
