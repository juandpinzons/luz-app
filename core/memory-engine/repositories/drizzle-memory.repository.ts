import { and, eq, or } from "drizzle-orm";
import type { Database } from "../../db/client";
import {
  type MemoryConnectionRow,
  type MemoryRow,
  memories,
  memoryConnections,
} from "../../db/schema";
import type { LifeGraphContext } from "../../life/life-graph-context";
import { type EntityId, createEntityId } from "../../life/value-objects/entity-id";
import type { MemoryConnection } from "../entities/memory-connection";
import type { Memory } from "../entities/memory";
import type { MemoryRepository } from "./memory.repository";

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

function toMemoryConnection(row: MemoryConnectionRow): MemoryConnection {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    fromMemoryId: createEntityId(row.fromMemoryId),
    toMemoryId: createEntityId(row.toMemoryId),
    strength: row.strength ?? undefined,
    createdAt: row.createdAt,
  };
}

/**
 * Solo persiste y recupera (mismo principio que
 * DrizzleLifeGraphRepository, Milestone 1) — capturar, rankear,
 * conectar, archivar y olvidar son responsabilidad de `lifecycle/`,
 * `ranking/` y `retrieval/`, no de este repositorio.
 *
 * `delete` es un borrado real, sin ninguna semántica de "forgotten":
 * esa decisión (soft-delete vía `status: "forgotten"`) vive en
 * ForgetStage, no aquí — este método hace exactamente lo que su
 * nombre dice, nada más. `content` nunca se transforma ni se recorta
 * en ningún método de esta clase: Memory es la base de la comprensión
 * de la persona, no un archivo a optimizar por espacio.
 */
export class DrizzleMemoryRepository implements MemoryRepository {
  constructor(private readonly db: Database) {}

  async getById(
    context: LifeGraphContext,
    id: EntityId,
  ): Promise<Memory | null> {
    const rows = await this.db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.id, id),
          eq(memories.lifeGraphId, context.lifeGraphId),
        ),
      )
      .limit(1);

    return rows[0] ? toMemory(rows[0]) : null;
  }

  async list(context: LifeGraphContext): Promise<Memory[]> {
    const rows = await this.db
      .select()
      .from(memories)
      .where(eq(memories.lifeGraphId, context.lifeGraphId));

    return rows.map(toMemory);
  }

  /**
   * Upsert. `memory.lifeGraphId` debe coincidir con
   * `context.lifeGraphId` — una discrepancia no se corrige en
   * silencio, es un error del llamador y se rechaza.
   */
  async save(context: LifeGraphContext, memory: Memory): Promise<Memory> {
    if (memory.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleMemoryRepository.save: memory.lifeGraphId (${memory.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }

    const [row] = await this.db
      .insert(memories)
      .values({
        id: memory.id,
        lifeGraphId: memory.lifeGraphId,
        personId: memory.personId ?? null,
        type: memory.type,
        content: memory.content,
        source: memory.source,
        sourceId: memory.sourceId ?? null,
        status: memory.status,
        rankScore: memory.rank?.score ?? null,
        rankedAt: memory.rank?.rankedAt ?? null,
        occurredAt: memory.occurredAt ?? null,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
      })
      .onConflictDoUpdate({
        target: memories.id,
        set: {
          personId: memory.personId ?? null,
          type: memory.type,
          content: memory.content,
          source: memory.source,
          sourceId: memory.sourceId ?? null,
          status: memory.status,
          rankScore: memory.rank?.score ?? null,
          rankedAt: memory.rank?.rankedAt ?? null,
          occurredAt: memory.occurredAt ?? null,
          updatedAt: memory.updatedAt,
        },
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleMemoryRepository.save: no se pudo persistir.");
    }

    return toMemory(row);
  }

  async delete(context: LifeGraphContext, id: EntityId): Promise<void> {
    await this.db
      .delete(memories)
      .where(
        and(
          eq(memories.id, id),
          eq(memories.lifeGraphId, context.lifeGraphId),
        ),
      );
  }

  /**
   * Conexiones donde `memoryId` participa en cualquiera de los dos
   * extremos — una memoria puede ser el origen o el destino de una
   * arista, y quien pregunta por sus conexiones quiere ambas.
   */
  async getConnections(
    context: LifeGraphContext,
    memoryId: EntityId,
  ): Promise<MemoryConnection[]> {
    const rows = await this.db
      .select()
      .from(memoryConnections)
      .where(
        and(
          eq(memoryConnections.lifeGraphId, context.lifeGraphId),
          or(
            eq(memoryConnections.fromMemoryId, memoryId),
            eq(memoryConnections.toMemoryId, memoryId),
          ),
        ),
      );

    return rows.map(toMemoryConnection);
  }

  async saveConnection(
    context: LifeGraphContext,
    connection: MemoryConnection,
  ): Promise<MemoryConnection> {
    if (connection.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleMemoryRepository.saveConnection: connection.lifeGraphId (${connection.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }

    const [row] = await this.db
      .insert(memoryConnections)
      .values({
        id: connection.id,
        lifeGraphId: connection.lifeGraphId,
        fromMemoryId: connection.fromMemoryId,
        toMemoryId: connection.toMemoryId,
        strength: connection.strength ?? null,
        createdAt: connection.createdAt,
      })
      .onConflictDoUpdate({
        target: memoryConnections.id,
        set: {
          strength: connection.strength ?? null,
        },
      })
      .returning();

    if (!row) {
      throw new Error(
        "DrizzleMemoryRepository.saveConnection: no se pudo persistir.",
      );
    }

    return toMemoryConnection(row);
  }
}
