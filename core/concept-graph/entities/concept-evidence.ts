import type { EntityId } from "../../life/value-objects/entity-id";

/** Por qué LUZ cree que un `Concept` aplica a esta persona (Principio 3, explicabilidad). */
export interface ConceptEvidence {
  id: EntityId;
  lifeGraphId: EntityId;
  conceptId: EntityId;
  insightId?: EntityId;
  memoryId: EntityId;
  createdAt: Date;
}
