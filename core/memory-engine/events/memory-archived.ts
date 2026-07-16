import type { DomainEvent } from "../../life/events/domain-event";
import type { EntityId } from "../../life/value-objects/entity-id";

export interface MemoryArchivedPayload {
  memoryId: EntityId;
}

export type MemoryArchived = DomainEvent<
  "memory.archived",
  MemoryArchivedPayload
>;
