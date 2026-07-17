import { and, eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { type PersonRow, persons } from "../../db/schema";
import type { Person } from "../entities/person";
import type { LifeGraphContext } from "../life-graph-context";
import { type EntityId, createEntityId } from "../value-objects/entity-id";
import type { PersonInput, PersonRepository } from "./person.repository";

function toPerson(row: PersonRow): Person {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    name: row.name,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * CRUD escopado por LifeGraphContext para miembros de un LifeGraph ya
 * existente (ADR-0011) — el punto de acceso normal de la aplicación,
 * distinto de DrizzleLifeGraphRepository.getMembers/saveMember, que
 * opera sobre el aggregate root en su conjunto (bootstrap, PR-004).
 * `toPerson` duplica a propósito el mapeo de
 * drizzle-life-graph.repository.ts: son responsabilidades de PRs
 * distintos, no algo a unificar aquí.
 */
export class DrizzlePersonRepository implements PersonRepository {
  constructor(private readonly db: Database) {}

  async getById(
    context: LifeGraphContext,
    id: EntityId,
  ): Promise<Person | null> {
    const rows = await this.db
      .select()
      .from(persons)
      .where(
        and(eq(persons.id, id), eq(persons.lifeGraphId, context.lifeGraphId)),
      )
      .limit(1);

    return rows[0] ? toPerson(rows[0]) : null;
  }

  async list(context: LifeGraphContext): Promise<Person[]> {
    const rows = await this.db
      .select()
      .from(persons)
      .where(eq(persons.lifeGraphId, context.lifeGraphId));

    return rows.map(toPerson);
  }

  async create(
    context: LifeGraphContext,
    input: PersonInput,
  ): Promise<Person> {
    const [row] = await this.db
      .insert(persons)
      .values({
        lifeGraphId: context.lifeGraphId,
        name: input.name,
        notes: input.notes ?? null,
      })
      .returning();

    if (!row) {
      throw new Error("DrizzlePersonRepository: create no devolvió fila.");
    }

    return toPerson(row);
  }

  async update(
    context: LifeGraphContext,
    id: EntityId,
    input: Partial<PersonInput>,
  ): Promise<Person> {
    const [row] = await this.db
      .update(persons)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(eq(persons.id, id), eq(persons.lifeGraphId, context.lifeGraphId)),
      )
      .returning();

    if (!row) {
      throw new Error(
        `DrizzlePersonRepository: no existe Person ${id} en este LifeGraph.`,
      );
    }

    return toPerson(row);
  }

  async delete(context: LifeGraphContext, id: EntityId): Promise<void> {
    await this.db
      .delete(persons)
      .where(
        and(eq(persons.id, id), eq(persons.lifeGraphId, context.lifeGraphId)),
      );
  }
}
