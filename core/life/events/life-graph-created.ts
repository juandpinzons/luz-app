import type { EntityId } from "../value-objects/entity-id";
import type { DomainEvent } from "./domain-event";

/** Emitido en el bootstrap de cuenta: un LifeGraph nuevo, con su owner. */
export interface LifeGraphCreatedPayload {
  lifeGraphId: EntityId;
  ownerPersonId: EntityId;
}

export type LifeGraphCreated = DomainEvent<
  "life.life_graph_created",
  LifeGraphCreatedPayload
>;
