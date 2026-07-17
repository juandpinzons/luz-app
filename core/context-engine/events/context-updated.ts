import type { DomainEvent } from "../../life/events/domain-event";
import type { EntityId } from "../../life/value-objects/entity-id";

/** Nombre coincide con EVENT_ARCHITECTURE.md's "ContextUpdated". */
export interface ContextUpdatedPayload {
  contextId: EntityId;
  itemCount: number;
}

export type ContextUpdated = DomainEvent<
  "context.updated",
  ContextUpdatedPayload
>;
