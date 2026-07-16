import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { Memory } from "../entities/memory";
import type { MemorySource } from "../value-objects/memory-source";
import type { MemoryType } from "../value-objects/memory-type";

/**
 * `type` es opcional: si se omite, el `MemoryClassifier` de la etapa
 * Classify lo asigna. `sourceId` es opaco a propósito (ver
 * `entities/memory.ts`).
 */
export interface MemoryCaptureInput {
  content: string;
  source: MemorySource;
  sourceId?: string;
  type?: MemoryType;
  personId?: EntityId;
  occurredAt?: Date;
}

/** Primera etapa del lifecycle (MEMORY_ENGINE_SPEC.md). */
export interface CaptureStage {
  capture(
    context: LifeGraphContext,
    input: MemoryCaptureInput,
  ): Promise<Memory>;
}
