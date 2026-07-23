import { and, eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { type RelationshipRow, lifeRelationships } from "../../db/schema";
import type { Relationship } from "../entities/relationship";
import type { LifeGraphContext } from "../life-graph-context";
import { type EntityId, createEntityId } from "../value-objects/entity-id";
import type {
  RelationshipInput,
  RelationshipRepository,
} from "./relationship.repository";

function toRelationship(row: RelationshipRow): Relationship {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    fromPersonId: createEntityId(row.fromPersonId),
    toPersonId: createEntityId(row.toPersonId),
    type: row.type,
    closeness: row.closeness ?? undefined,
    since: row.since ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** CRUD escopado por LifeGraphContext para `Relationship` (mismo patrón que DrizzlePersonRepository). */
export class DrizzleRelationshipRepository implements RelationshipRepository {
  constructor(private readonly db: Database) {}

  async getById(
    context: LifeGraphContext,
    id: EntityId,
  ): Promise<Relationship | null> {
    const rows = await this.db
      .select()
      .from(lifeRelationships)
      .where(
        and(
          eq(lifeRelationships.id, id),
          eq(lifeRelationships.lifeGraphId, context.lifeGraphId),
        ),
      )
      .limit(1);

    return rows[0] ? toRelationship(rows[0]) : null;
  }

  async list(context: LifeGraphContext): Promise<Relationship[]> {
    const rows = await this.db
      .select()
      .from(lifeRelationships)
      .where(eq(lifeRelationships.lifeGraphId, context.lifeGraphId));

    return rows.map(toRelationship);
  }

  async create(
    context: LifeGraphContext,
    input: RelationshipInput,
  ): Promise<Relationship> {
    const [row] = await this.db
      .insert(lifeRelationships)
      .values({
        lifeGraphId: context.lifeGraphId,
        fromPersonId: input.fromPersonId,
        toPersonId: input.toPersonId,
        type: input.type,
        closeness: input.closeness ?? null,
        since: input.since ?? null,
        notes: input.notes ?? null,
      })
      .returning();

    if (!row) {
      throw new Error(
        "DrizzleRelationshipRepository: create no devolvió fila.",
      );
    }

    return toRelationship(row);
  }

  async update(
    context: LifeGraphContext,
    id: EntityId,
    input: Partial<RelationshipInput>,
  ): Promise<Relationship> {
    const [row] = await this.db
      .update(lifeRelationships)
      .set({
        ...(input.fromPersonId !== undefined
          ? { fromPersonId: input.fromPersonId }
          : {}),
        ...(input.toPersonId !== undefined
          ? { toPersonId: input.toPersonId }
          : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.closeness !== undefined
          ? { closeness: input.closeness ?? null }
          : {}),
        ...(input.since !== undefined ? { since: input.since ?? null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(lifeRelationships.id, id),
          eq(lifeRelationships.lifeGraphId, context.lifeGraphId),
        ),
      )
      .returning();

    if (!row) {
      throw new Error(
        `DrizzleRelationshipRepository: no existe Relationship ${id} en este LifeGraph.`,
      );
    }

    return toRelationship(row);
  }

  async delete(context: LifeGraphContext, id: EntityId): Promise<void> {
    await this.db
      .delete(lifeRelationships)
      .where(
        and(
          eq(lifeRelationships.id, id),
          eq(lifeRelationships.lifeGraphId, context.lifeGraphId),
        ),
      );
  }
}
