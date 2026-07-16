import type { DomainEvent } from "../../life/events/domain-event";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { MemoryType } from "../value-objects/memory-type";

export interface MemoryCapturedPayload {
  memoryId: EntityId;
  type: MemoryType;
}

export type MemoryCaptured = DomainEvent<
  "memory.captured",
  MemoryCapturedPayload
>;
