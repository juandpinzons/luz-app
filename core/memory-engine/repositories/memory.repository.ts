import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { MemoryConnection } from "../entities/memory-connection";
import type { Memory } from "../entities/memory";

/**
 * Solo persiste y recupera — nunca orquesta (misma corrección que
 * `LifeGraphRepository`, Milestone 2). Capturar, rankear, conectar,
 * archivar y olvidar son responsabilidad de las interfaces de
 * `lifecycle/`, `ranking/` y `retrieval/`, que usan este repositorio
 * como su único punto de acceso a datos.
 */
export interface MemoryRepository {
  getById(context: LifeGraphContext, id: EntityId): Promise<Memory | null>;
  list(context: LifeGraphContext): Promise<Memory[]>;
  save(context: LifeGraphContext, memory: Memory): Promise<Memory>;
  delete(context: LifeGraphContext, id: EntityId): Promise<void>;
  getConnections(
    context: LifeGraphContext,
    memoryId: EntityId,
  ): Promise<MemoryConnection[]>;
  saveConnection(
    context: LifeGraphContext,
    connection: MemoryConnection,
  ): Promise<MemoryConnection>;
}
