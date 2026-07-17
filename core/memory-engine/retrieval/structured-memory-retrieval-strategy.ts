import { and, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { type MemoryRow, memories } from "../../db/schema";
import type { LifeGraphContext } from "../../life/life-graph-context";
import { createEntityId } from "../../life/value-objects/entity-id";
import type { Memory } from "../entities/memory";
import type { MemoryQuery } from "./memory-query";
import type { MemoryRetrievalStrategy } from "./memory-retrieval-strategy";

const DEFAULT_LIMIT = 50;

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
 * Ordena por `rankScore` descendente (NULLS LAST): la memoria más
 * valiosa para entender a la persona primero (PR-014), no la más
 * reciente. Las memorias sin rank todavía calculado se incluyen, solo
 * al final — nunca se descartan.
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

    const rows = await this.db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(
        sql`${memories.rankScore} DESC NULLS LAST`,
        desc(memories.createdAt),
      )
      .limit(query.limit ?? DEFAULT_LIMIT);

    return rows.map(toMemory);
  }
}
