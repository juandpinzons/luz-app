import { and, eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { type HabitRow, lifeHabits } from "../../db/schema";
import type { Habit } from "../entities/habit";
import type { LifeGraphContext } from "../life-graph-context";
import { type EntityId, createEntityId } from "../value-objects/entity-id";
import type { HabitInput, HabitRepository } from "./habit.repository";

function toHabit(row: HabitRow): Habit {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    goalId: row.goalId ? createEntityId(row.goalId) : undefined,
    title: row.title,
    description: row.description ?? undefined,
    domain: row.domain ?? undefined,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** CRUD escopado por LifeGraphContext para `Habit` (mismo patrón que DrizzlePersonRepository). */
export class DrizzleHabitRepository implements HabitRepository {
  constructor(private readonly db: Database) {}

  async getById(
    context: LifeGraphContext,
    id: EntityId,
  ): Promise<Habit | null> {
    const rows = await this.db
      .select()
      .from(lifeHabits)
      .where(
        and(
          eq(lifeHabits.id, id),
          eq(lifeHabits.lifeGraphId, context.lifeGraphId),
        ),
      )
      .limit(1);

    return rows[0] ? toHabit(rows[0]) : null;
  }

  async list(context: LifeGraphContext): Promise<Habit[]> {
    const rows = await this.db
      .select()
      .from(lifeHabits)
      .where(eq(lifeHabits.lifeGraphId, context.lifeGraphId));

    return rows.map(toHabit);
  }

  async create(context: LifeGraphContext, input: HabitInput): Promise<Habit> {
    const [row] = await this.db
      .insert(lifeHabits)
      .values({
        lifeGraphId: context.lifeGraphId,
        goalId: input.goalId ?? null,
        title: input.title,
        description: input.description ?? null,
        domain: input.domain ?? null,
        active: input.active,
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleHabitRepository: create no devolvió fila.");
    }

    return toHabit(row);
  }

  async update(
    context: LifeGraphContext,
    id: EntityId,
    input: Partial<HabitInput>,
  ): Promise<Habit> {
    const [row] = await this.db
      .update(lifeHabits)
      .set({
        ...(input.goalId !== undefined ? { goalId: input.goalId ?? null } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description ?? null }
          : {}),
        ...(input.domain !== undefined ? { domain: input.domain ?? null } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(lifeHabits.id, id),
          eq(lifeHabits.lifeGraphId, context.lifeGraphId),
        ),
      )
      .returning();

    if (!row) {
      throw new Error(
        `DrizzleHabitRepository: no existe Habit ${id} en este LifeGraph.`,
      );
    }

    return toHabit(row);
  }

  async delete(context: LifeGraphContext, id: EntityId): Promise<void> {
    await this.db
      .delete(lifeHabits)
      .where(
        and(
          eq(lifeHabits.id, id),
          eq(lifeHabits.lifeGraphId, context.lifeGraphId),
        ),
      );
  }
}
