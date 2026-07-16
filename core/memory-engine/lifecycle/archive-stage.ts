import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { Memory } from "../entities/memory";

/** Marca una memoria como `archived` — sigue existiendo, deja de rankearse. */
export interface ArchiveStage {
  archive(context: LifeGraphContext, memoryId: EntityId): Promise<Memory>;
}
