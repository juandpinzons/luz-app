import type { DomainEvent } from "../../life/events/domain-event";
import type { EntityId } from "../../life/value-objects/entity-id";

export interface MemoryConnectedPayload {
  fromMemoryId: EntityId;
  toMemoryId: EntityId;
}

export type MemoryConnected = DomainEvent<
  "memory.connected",
  MemoryConnectedPayload
>;
