import type { EntityId } from "../value-objects/entity-id";
import type { RelationshipType } from "../value-objects/relationship-type";
import type { DomainEvent } from "./domain-event";

export interface RelationshipUpdatedPayload {
  relationshipId: EntityId;
  /** El otro extremo de la relación — el actor va en el sobre del evento. */
  toPersonId: EntityId;
  type: RelationshipType;
  previousType?: RelationshipType;
}

export type RelationshipUpdated = DomainEvent<
  "life.relationship_updated",
  RelationshipUpdatedPayload
>;
