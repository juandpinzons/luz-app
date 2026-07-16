import type { EntityId } from "../value-objects/entity-id";
import type { RelationshipType } from "../value-objects/relationship-type";

/**
 * Vínculo entre dos miembros (`Person`) del mismo `LifeGraph`. Ya no
 * asume que uno de los dos extremos es "el usuario" — un LifeGraph
 * compartido (familia, organización) puede tener relaciones entre
 * cualquier par de sus miembros, por eso ambos extremos son explícitos
 * (`fromPersonId`/`toPersonId`) en vez de asumir un lado implícito.
 * Separado de `Person` para que el tipo de relación pueda evolucionar
 * (p. ej. de "colleague" a "friend") sin reescribir la identidad de la
 * persona.
 */
export interface Relationship {
  id: EntityId;
  lifeGraphId: EntityId;
  fromPersonId: EntityId;
  toPersonId: EntityId;
  type: RelationshipType;
  /** Cercanía percibida, 0-100. */
  closeness?: number;
  since?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
