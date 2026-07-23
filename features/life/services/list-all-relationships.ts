import type { Database } from "../../../core/db/client";
import {
  type Relationship,
  type LifeGraphContext,
  DrizzleRelationshipRepository,
  DrizzlePersonRepository,
} from "../../../core/life";

export interface RelationshipWithDisplayName extends Relationship {
  /** Nombre de la persona al otro lado del vínculo (nunca `context.personId`) — Person.name si se resolvió, o "Alguien" si no. */
  otherPersonName: string;
}

/**
 * Todas las Relationships del LifeGraph, con el nombre de la otra
 * persona ya resuelto — `Relationship` no tiene `title` como
 * Goal/Project/Habit (ADR: ambos extremos son explícitos, ninguno es
 * "el usuario" por defecto), así que la tarjeta necesita este dato
 * para mostrar algo legible.
 */
export async function listAllRelationships(
  db: Database,
  context: LifeGraphContext,
): Promise<RelationshipWithDisplayName[]> {
  const [relationships, people] = await Promise.all([
    new DrizzleRelationshipRepository(db).list(context),
    new DrizzlePersonRepository(db).list(context),
  ]);

  const nameById = new Map(people.map((person) => [person.id, person.name]));

  return relationships.map((relationship) => {
    const otherPersonId =
      relationship.fromPersonId === context.personId
        ? relationship.toPersonId
        : relationship.fromPersonId;

    return {
      ...relationship,
      otherPersonName: nameById.get(otherPersonId) ?? "Alguien",
    };
  });
}
