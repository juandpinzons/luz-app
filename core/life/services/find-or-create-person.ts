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
 */
export async function findOrCreatePerson(
  db: Database,
  context: LifeGraphContext,
  input: FindOrCreatePersonInput,
): Promise<Person> {
  const repository = new DrizzlePersonRepository(db);
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
}
