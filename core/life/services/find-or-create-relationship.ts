import { sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import type { Relationship } from "../entities/relationship";
import type { RelationshipType } from "../value-objects/relationship-type";
import type { LifeGraphContext } from "../life-graph-context";
import { DrizzleRelationshipRepository } from "../repositories/drizzle-relationship.repository";
import { findOrCreatePerson } from "./find-or-create-person";

export interface FindOrCreateRelationshipInput {
  otherPersonName: string;
  type: RelationshipType;
}

/**
 * Mismo patrón que `find-or-create-goal.ts`, adaptado: `Relationship`
 * no tiene título — el vínculo se identifica por el par de personas
 * (`fromPersonId`/`toPersonId`), nunca por texto libre. Dedup por
 * ambas direcciones del par: la misma persona ya conectada, sin
 * importar quién es `from` y quién `to`, no produce una fila nueva.
 * `context.personId` siempre es el extremo `from` cuando se crea
 * desde acá — quien tiene la conversación con LUZ.
 *
 * War Room 2026-07-29: `findOrCreatePerson` ya se protege a sí mismo
 * (ver su propio docblock) -- corre como su propia transacción, antes
 * de esta, nunca anidada. La búsqueda/creación de la Relationship en
 * sí tiene el mismo hallazgo de concurrencia que `find-or-create-goal.ts`
 * y la misma solución, con su propio lock (acotado a ':relationship',
 * nunca comparte el lock de ':person').
 */
export async function findOrCreateRelationship(
  db: Database,
  context: LifeGraphContext,
  input: FindOrCreateRelationshipInput,
): Promise<Relationship> {
  const otherPerson = await findOrCreatePerson(db, context, {
    name: input.otherPersonName,
  });

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.lifeGraphId} || ':relationship'))`,
    );

    const repository = new DrizzleRelationshipRepository(tx);
    const existingRelationships = await repository.list(context);
    const match = existingRelationships.find(
      (relationship) =>
        (relationship.fromPersonId === context.personId &&
          relationship.toPersonId === otherPerson.id) ||
        (relationship.toPersonId === context.personId &&
          relationship.fromPersonId === otherPerson.id),
    );

    if (match) {
      return match;
    }

    return repository.create(context, {
      fromPersonId: context.personId,
      toPersonId: otherPerson.id,
      type: input.type,
      closeness: undefined,
      since: undefined,
      notes: undefined,
    });
  });
}
