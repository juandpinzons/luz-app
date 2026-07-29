import { sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import type { Person } from "../entities/person";
import type { LifeGraphContext } from "../life-graph-context";
import { DrizzlePersonRepository } from "../repositories/drizzle-person.repository";
import { titlesLikelyMatch } from "./title-similarity";

export interface FindOrCreatePersonInput {
  name: string;
}

/**
 * Mismo patrón que `find-or-create-goal.ts` — dedup por nombre, no una
 * segunda entidad si la persona ya existe en este LifeGraph.
 * Usado por `find-or-create-relationship.ts`: `Relationship` conecta
 * dos `Person`, nunca un nombre suelto.
 *
 * War Room 2026-07-29: mismo hallazgo de concurrencia y misma solución
 * que `find-or-create-goal.ts` -- ver ese docblock.
 */
export async function findOrCreatePerson(
  db: Database,
  context: LifeGraphContext,
  input: FindOrCreatePersonInput,
): Promise<Person> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.lifeGraphId} || ':person'))`,
    );

    const repository = new DrizzlePersonRepository(tx);
    const existingPeople = await repository.list(context);
    const match = existingPeople.find((person) =>
      titlesLikelyMatch(person.name, input.name),
    );

    if (match) {
      return match;
    }

    return repository.create(context, {
      name: input.name,
      notes: undefined,
    });
  });
}
