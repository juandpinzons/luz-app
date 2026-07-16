import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { MemoryConnection } from "../entities/memory-connection";

/** Relaciona una memoria con otras ya capturadas. No interpreta la relación. */
export interface ConnectStage {
  connect(
    context: LifeGraphContext,
    memoryId: EntityId,
  ): Promise<MemoryConnection[]>;
}
