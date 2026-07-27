import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { ImportanceScore } from "../entities/importance-score";

export interface ImportanceRepository {
  getByEntity(
    context: LifeGraphContext,
    entityType: string,
    entityId: EntityId,
  ): Promise<ImportanceScore | null>;
  /** Todo el LifeGraph -- la lista es pequeña (solo entidades que ya recibieron un cálculo), pensada para filtrar en memoria. */
  list(context: LifeGraphContext): Promise<ImportanceScore[]>;
  /** Upsert sobre (lifeGraphId, entityType, entityId). */
  save(context: LifeGraphContext, score: ImportanceScore): Promise<ImportanceScore>;
}
