import { and, cosineDistance, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { AIProvider } from "../../../ai/provider";
import type { Database } from "../../db/client";
import { type MemoryRow, memories, memoryEmbeddings } from "../../db/schema";
import type { LifeGraphContext } from "../../life/life-graph-context";
import { createEntityId } from "../../life/value-objects/entity-id";
import type { Memory } from "../entities/memory";
import type { MemoryQuery } from "./memory-query";
import type { MemoryRetrievalStrategy } from "./memory-retrieval-strategy";

const DEFAULT_LIMIT = 50;
/**
 * Pool candidato sobre `memory_embeddings` antes de cruzarlo con
 * `memories` real -- mismo principio de techo absoluto que
 * `StructuredMemoryRetrievalStrategy` (`CANDIDATE_POOL_CEILING`), acá
 * más generoso porque el filtro de `status`/`suppressed` todavía no se
 * aplicó a este nivel (pgvector no conoce esas columnas).
 */
const EMBEDDING_CANDIDATE_CEILING = 100;

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

/**
 * Mitad "semántica" de ADR-0004 (Hybrid Memory) -- sucesor directo de
 * `NotImplementedSemanticMemoryRepository` (`core/memory`, retirado por
 * ADR-0012/MEMORY_ENGINE_MIGRATION_PLAN.md Fase B). Recupera por
 * significado (embeddings, pgvector `cosineDistance`), nunca por
 * coincidencia de texto exacta -- complementa, no reemplaza,
 * `StructuredMemoryRetrievalStrategy`.
 *
 * `query.text` es obligatorio para esta estrategia -- sin texto no hay
 * nada que embeber ni comparar; devuelve `[]` en vez de lanzar, mismo
 * criterio de degradación honesta que el resto de Memory Engine (nunca
 * fabricar candidatas de la nada).
 *
 * Solo compara contra memorias con `embedding` ya generado
 * (`isNotNull`) -- una memoria sin embedding todavía (job de
 * `process-knowledge-job.ts` no ha corrido, o falló) simplemente no
 * compite en esta mitad, nunca lanza ni bloquea al resto del pool.
 * Filtra `status: "active"`/`suppressed: false` DESPUÉS de la
 * comparación vectorial (columnas que no existen en `memory_embeddings`
 * -- pgvector no puede filtrarlas), sobre un pool ya acotado
 * (`EMBEDDING_CANDIDATE_CEILING`), nunca sobre la tabla completa.
 */
export class AISemanticMemoryRetrievalStrategy implements MemoryRetrievalStrategy {
  constructor(
    private readonly db: Database,
    private readonly ai: AIProvider,
  ) {}

  async retrieve(context: LifeGraphContext, query: MemoryQuery): Promise<Memory[]> {
    if (!query.text) {
      return [];
    }

    const limit = query.limit ?? DEFAULT_LIMIT;
    const queryEmbedding = await this.ai.embed(query.text);
    const distance = cosineDistance(memoryEmbeddings.embedding, queryEmbedding);

    const candidates = await this.db
      .select({ sourceId: memoryEmbeddings.sourceId, distance: sql<number>`${distance}` })
      .from(memoryEmbeddings)
      .where(
        and(
          eq(memoryEmbeddings.lifeGraphId, context.lifeGraphId),
          eq(memoryEmbeddings.sourceType, "memory"),
          isNotNull(memoryEmbeddings.embedding),
        ),
      )
      .orderBy(distance)
      .limit(EMBEDDING_CANDIDATE_CEILING);

    if (candidates.length === 0) {
      return [];
    }

    const orderBySourceId = new Map(candidates.map((row, index) => [row.sourceId, index]));

    const rows = await this.db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.lifeGraphId, context.lifeGraphId),
          eq(memories.status, "active"),
          eq(memories.suppressed, false),
          inArray(
            memories.id,
            candidates.map((row) => row.sourceId),
          ),
        ),
      );

    return rows
      .map(toMemory)
      .sort((a, b) => (orderBySourceId.get(a.id) ?? Infinity) - (orderBySourceId.get(b.id) ?? Infinity))
      .slice(0, limit);
  }
}
