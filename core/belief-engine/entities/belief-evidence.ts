import type { EntityId } from "../../life/value-objects/entity-id";

/** Por qué LUZ sostiene este Belief (Principio 3, explicabilidad). */
export interface BeliefEvidence {
  id: EntityId;
  lifeGraphId: EntityId;
  beliefId: EntityId;
  insightId?: EntityId;
  memoryId?: EntityId;
  createdAt: Date;
}
