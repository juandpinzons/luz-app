import type { EntityId } from "../value-objects/entity-id";
import type { DomainEvent } from "./domain-event";

/** Emitido cuando un nuevo miembro (owner o related) se une al grafo. */
export interface PersonAddedToLifeGraphPayload {
  addedPersonId: EntityId;
  isOwner: boolean;
}

export type PersonAddedToLifeGraph = DomainEvent<
  "life.person_added_to_life_graph",
  PersonAddedToLifeGraphPayload
>;
