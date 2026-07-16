import type { EntityId } from "../value-objects/entity-id";
import type { DomainEvent } from "./domain-event";

export interface LifeEventRegisteredPayload {
  lifeEventId: EntityId;
  title: string;
  occurredAt: Date;
}

export type LifeEventRegistered = DomainEvent<
  "life.event_registered",
  LifeEventRegisteredPayload
>;
