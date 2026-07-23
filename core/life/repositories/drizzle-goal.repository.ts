import { and, eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { type GoalRow, lifeGoals } from "../../db/schema";
import type { Goal } from "../entities/goal";
import type { LifeGraphContext } from "../life-graph-context";
import { type EntityId, createEntityId } from "../value-objects/entity-id";
import type { GoalInput, GoalRepository } from "./goal.repository";

function toGoal(row: GoalRow): Goal {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    domain: row.domain ?? undefined,
    targetDate: row.targetDate ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** CRUD escopado por LifeGraphContext para `Goal` (mismo patrón que DrizzlePersonRepository). */
export class DrizzleGoalRepository implements GoalRepository {
  constructor(private readonly db: Database) {}

  async getById(context: LifeGraphContext, id: EntityId): Promise<Goal | null> {
    const rows = await this.db
      .select()
      .from(lifeGoals)
      .where(
        and(eq(lifeGoals.id, id), eq(lifeGoals.lifeGraphId, context.lifeGraphId)),
      )
      .limit(1);

    return rows[0] ? toGoal(rows[0]) : null;
  }

  async list(context: LifeGraphContext): Promise<Goal[]> {
    const rows = await this.db
      .select()
      .from(lifeGoals)
      .where(eq(lifeGoals.lifeGraphId, context.lifeGraphId));

    return rows.map(toGoal);
  }

  async create(context: LifeGraphContext, input: GoalInput): Promise<Goal> {
    const [row] = await this.db
      .insert(lifeGoals)
      .values({
        lifeGraphId: context.lifeGraphId,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        domain: input.domain ?? null,
        targetDate: input.targetDate ?? null,
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleGoalRepository: create no devolvió fila.");
    }

    return toGoal(row);
  }

  async update(
    context: LifeGraphContext,
    id: EntityId,
    input: Partial<GoalInput>,
  ): Promise<Goal> {
    const [row] = await this.db
      .update(lifeGoals)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description ?? null }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.domain !== undefined ? { domain: input.domain ?? null } : {}),
        ...(input.targetDate !== undefined
          ? { targetDate: input.targetDate ?? null }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(eq(lifeGoals.id, id), eq(lifeGoals.lifeGraphId, context.lifeGraphId)),
      )
      .returning();

    if (!row) {
      throw new Error(
        `DrizzleGoalRepository: no existe Goal ${id} en este LifeGraph.`,
      );
    }

    return toGoal(row);
  }

  async delete(context: LifeGraphContext, id: EntityId): Promise<void> {
    await this.db
      .delete(lifeGoals)
      .where(
        and(eq(lifeGoals.id, id), eq(lifeGoals.lifeGraphId, context.lifeGraphId)),
      );
  }
}
