import type { DomainEvent } from "../../life/events/domain-event";
import type { EntityId } from "../../life/value-objects/entity-id";

export interface MemoryRankedPayload {
  memoryId: EntityId;
  score: number;
}

export type MemoryRanked = DomainEvent<"memory.ranked", MemoryRankedPayload>;
