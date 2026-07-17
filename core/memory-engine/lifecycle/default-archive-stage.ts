import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { Memory } from "../entities/memory";
import type { MemoryRepository } from "../repositories/memory.repository";
import type { ArchiveStage } from "./archive-stage";

/**
 * Marca una memoria como `archived`: sigue existiendo con su contenido
 * y su último `rank` intactos, solo deja de participar en futuras
 * ejecuciones de ranking (decisión de la estrategia de ranking, no de
 * esta etapa). No borra ni transforma nada — archivar no es olvidar
 * (ver default-forget-stage.ts).
 */
export class DefaultArchiveStage implements ArchiveStage {
  constructor(private readonly repository: MemoryRepository) {}

  async archive(
    context: LifeGraphContext,
    memoryId: EntityId,
  ): Promise<Memory> {
    const memory = await this.repository.getById(context, memoryId);

    if (!memory) {
      throw new Error(
        `DefaultArchiveStage: no existe Memory ${memoryId} en este LifeGraph.`,
      );
    }

    return this.repository.save(context, {
      ...memory,
      status: "archived",
      updatedAt: new Date(),
    });
  }
}
