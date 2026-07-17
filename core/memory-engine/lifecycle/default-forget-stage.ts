import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { MemoryRepository } from "../repositories/memory.repository";
import type { ForgetStage } from "./forget-stage";

/**
 * Decisión de Phase B que MEMORY_ENGINE_MIGRATION_PLAN.md deja
 * explícitamente abierta: olvidar es un soft-mark (`status:
 * "forgotten"`), no un DELETE. El `MemoryStatus` del dominio ya
 * incluye "forgotten" como estado propio — un hard delete lo volvería
 * inalcanzable. Preservar el contenido incluso al olvidar prioriza la
 * comprensión de largo plazo de la persona sobre el ahorro de espacio.
 */
export class DefaultForgetStage implements ForgetStage {
  constructor(private readonly repository: MemoryRepository) {}

  async forget(context: LifeGraphContext, memoryId: EntityId): Promise<void> {
    const memory = await this.repository.getById(context, memoryId);

    if (!memory) {
      throw new Error(
        `DefaultForgetStage: no existe Memory ${memoryId} en este LifeGraph.`,
      );
    }

    await this.repository.save(context, {
      ...memory,
      status: "forgotten",
      updatedAt: new Date(),
    });
  }
}
