import { and, eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { type ProjectRow, lifeProjects } from "../../db/schema";
import type { Project } from "../entities/project";
import type { LifeGraphContext } from "../life-graph-context";
import { type EntityId, createEntityId } from "../value-objects/entity-id";
import type { ProjectInput, ProjectRepository } from "./project.repository";

function toProject(row: ProjectRow): Project {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    goalId: row.goalId ? createEntityId(row.goalId) : undefined,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    domain: row.domain ?? undefined,
    startDate: row.startDate ?? undefined,
    dueDate: row.dueDate ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** CRUD escopado por LifeGraphContext para `Project` (mismo patrón que DrizzlePersonRepository). */
export class DrizzleProjectRepository implements ProjectRepository {
  constructor(private readonly db: Database) {}

  async getById(
    context: LifeGraphContext,
    id: EntityId,
  ): Promise<Project | null> {
    const rows = await this.db
      .select()
      .from(lifeProjects)
      .where(
        and(
          eq(lifeProjects.id, id),
          eq(lifeProjects.lifeGraphId, context.lifeGraphId),
        ),
      )
      .limit(1);

    return rows[0] ? toProject(rows[0]) : null;
  }

  async list(context: LifeGraphContext): Promise<Project[]> {
    const rows = await this.db
      .select()
      .from(lifeProjects)
      .where(eq(lifeProjects.lifeGraphId, context.lifeGraphId));

    return rows.map(toProject);
  }

  async create(context: LifeGraphContext, input: ProjectInput): Promise<Project> {
    const [row] = await this.db
      .insert(lifeProjects)
      .values({
        lifeGraphId: context.lifeGraphId,
        goalId: input.goalId ?? null,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        domain: input.domain ?? null,
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleProjectRepository: create no devolvió fila.");
    }

    return toProject(row);
  }

  async update(
    context: LifeGraphContext,
    id: EntityId,
    input: Partial<ProjectInput>,
  ): Promise<Project> {
    const [row] = await this.db
      .update(lifeProjects)
      .set({
        ...(input.goalId !== undefined ? { goalId: input.goalId ?? null } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description ?? null }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.domain !== undefined ? { domain: input.domain ?? null } : {}),
        ...(input.startDate !== undefined
          ? { startDate: input.startDate ?? null }
          : {}),
        ...(input.dueDate !== undefined
          ? { dueDate: input.dueDate ?? null }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(lifeProjects.id, id),
          eq(lifeProjects.lifeGraphId, context.lifeGraphId),
        ),
      )
      .returning();

    if (!row) {
      throw new Error(
        `DrizzleProjectRepository: no existe Project ${id} en este LifeGraph.`,
      );
    }

    return toProject(row);
  }

  async delete(context: LifeGraphContext, id: EntityId): Promise<void> {
    await this.db
      .delete(lifeProjects)
      .where(
        and(
          eq(lifeProjects.id, id),
          eq(lifeProjects.lifeGraphId, context.lifeGraphId),
        ),
      );
  }
}
