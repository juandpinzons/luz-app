import type { EntityId } from "../../life/value-objects/entity-id";

/**
 * Arista dirigida entre dos `Concept` — "Gym lleva_a Disciplina" es
 * distinto de "Disciplina lleva_a Gym". `relationType` es texto libre,
 * mismo criterio que `InsightRelationship.relationType`.
 */
export interface ConceptRelation {
  id: EntityId;
  lifeGraphId: EntityId;
  fromConceptId: EntityId;
  toConceptId: EntityId;
  relationType: string;
  strength?: number;
  createdAt: Date;
}
