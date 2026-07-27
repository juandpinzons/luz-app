import type { EntityId } from "../../life/value-objects/entity-id";

/**
 * `entityType` es texto libre a propósito (mismo criterio que
 * `ContradictionRef.refType`) -- la lista de tipos que pueden tener
 * importancia crece con el dominio (memoria, persona, goal, insight,
 * belief, concepto...), no debe forzarse a un enum cerrado.
 */
export interface ImportanceScore {
  id: EntityId;
  lifeGraphId: EntityId;
  entityType: string;
  entityId: EntityId;
  score: number;
  reason: string;
  updatedAt: Date;
}
