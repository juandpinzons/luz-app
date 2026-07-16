import type { DomainEvent } from "../../life/events/domain-event";
import type { EntityId } from "../../life/value-objects/entity-id";

export interface MemoryForgottenPayload {
  memoryId: EntityId;
}

export type MemoryForgotten = DomainEvent<
  "memory.forgotten",
  MemoryForgottenPayload
>;
