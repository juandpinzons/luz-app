import { and, eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { type RoutineRow, lifeRoutines } from "../../db/schema";
import type { Routine } from "../entities/routine";
import type { LifeGraphContext } from "../life-graph-context";
import { type EntityId, createEntityId } from "../value-objects/entity-id";
import type { RoutineInput, RoutineRepository } from "./routine.repository";

function toRoutine(row: RoutineRow): Routine {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    habitId: row.habitId ? createEntityId(row.habitId) : undefined,
    title: row.title,
    frequency: row.frequency,
    domain: row.domain ?? undefined,
    detectedAt: row.detectedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** CRUD escopado por LifeGraphContext para `Routine` (mismo patrón que DrizzlePersonRepository). */
export class DrizzleRoutineRepository implements RoutineRepository {
  constructor(private readonly db: Database) {}

  async getById(
    context: LifeGraphContext,
    id: EntityId,
  ): Promise<Routine | null> {
    const rows = await this.db
      .select()
      .from(lifeRoutines)
      .where(
        and(
          eq(lifeRoutines.id, id),
          eq(lifeRoutines.lifeGraphId, context.lifeGraphId),
        ),
      )
      .limit(1);

    return rows[0] ? toRoutine(rows[0]) : null;
  }

  async list(context: LifeGraphContext): Promise<Routine[]> {
    const rows = await this.db
      .select()
      .from(lifeRoutines)
      .where(eq(lifeRoutines.lifeGraphId, context.lifeGraphId));

    return rows.map(toRoutine);
  }

  async create(
    context: LifeGraphContext,
    input: RoutineInput,
  ): Promise<Routine> {
    const [row] = await this.db
      .insert(lifeRoutines)
      .values({
        lifeGraphId: context.lifeGraphId,
        habitId: input.habitId ?? null,
        title: input.title,
        frequency: input.frequency,
        domain: input.domain ?? null,
        detectedAt: input.detectedAt,
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleRoutineRepository: create no devolvió fila.");
    }

    return toRoutine(row);
  }

  async update(
    context: LifeGraphContext,
    id: EntityId,
    input: Partial<RoutineInput>,
  ): Promise<Routine> {
    const [row] = await this.db
      .update(lifeRoutines)
      .set({
        ...(input.habitId !== undefined
          ? { habitId: input.habitId ?? null }
          : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.frequency !== undefined
          ? { frequency: input.frequency }
          : {}),
        ...(input.domain !== undefined ? { domain: input.domain ?? null } : {}),
        ...(input.detectedAt !== undefined
          ? { detectedAt: input.detectedAt }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(lifeRoutines.id, id),
          eq(lifeRoutines.lifeGraphId, context.lifeGraphId),
        ),
      )
      .returning();

    if (!row) {
      throw new Error(
        `DrizzleRoutineRepository: no existe Routine ${id} en este LifeGraph.`,
      );
    }

    return toRoutine(row);
  }

  async delete(context: LifeGraphContext, id: EntityId): Promise<void> {
    await this.db
      .delete(lifeRoutines)
      .where(
        and(
          eq(lifeRoutines.id, id),
          eq(lifeRoutines.lifeGraphId, context.lifeGraphId),
        ),
      );
  }
}
