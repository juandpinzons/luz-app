import { and, eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { type LifeDomainRow, lifeDomains } from "../../db/schema";
import type { LifeDomain } from "../entities/life-domain";
import type { LifeGraphContext } from "../life-graph-context";
import { type EntityId, createEntityId } from "../value-objects/entity-id";
import type { LifeDomainInput, LifeDomainRepository } from "./life-domain.repository";

function toLifeDomain(row: LifeDomainRow): LifeDomain {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    type: row.type,
    priority: row.priority ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * CRUD escopado por LifeGraphContext para `LifeDomain`, mismo patrón que
 * `DrizzleGoalRepository`. `create()` es upsert sobre
 * (lifeGraphId, type) — mismo criterio ya documentado en
 * `life_domains_life_graph_id_type_idx`: un área de vida es única por
 * LifeGraph, así que "crear" el mismo dominio dos veces actualiza en
 * vez de duplicar (ver `getOrCreateLifeDomain`, el único llamador real
 * de `create`).
 */
export class DrizzleLifeDomainRepository implements LifeDomainRepository {
  constructor(private readonly db: Database) {}

  async getById(context: LifeGraphContext, id: EntityId): Promise<LifeDomain | null> {
    const rows = await this.db
      .select()
      .from(lifeDomains)
      .where(
        and(eq(lifeDomains.id, id), eq(lifeDomains.lifeGraphId, context.lifeGraphId)),
      )
      .limit(1);

    return rows[0] ? toLifeDomain(rows[0]) : null;
  }

  async list(context: LifeGraphContext): Promise<LifeDomain[]> {
    const rows = await this.db
      .select()
      .from(lifeDomains)
      .where(eq(lifeDomains.lifeGraphId, context.lifeGraphId));

    return rows.map(toLifeDomain);
  }

  async getByType(
    context: LifeGraphContext,
    type: LifeDomain["type"],
  ): Promise<LifeDomain | null> {
    const rows = await this.db
      .select()
      .from(lifeDomains)
      .where(
        and(
          eq(lifeDomains.lifeGraphId, context.lifeGraphId),
          eq(lifeDomains.type, type),
        ),
      )
      .limit(1);

    return rows[0] ? toLifeDomain(rows[0]) : null;
  }

  async create(context: LifeGraphContext, input: LifeDomainInput): Promise<LifeDomain> {
    const [row] = await this.db
      .insert(lifeDomains)
      .values({
        lifeGraphId: context.lifeGraphId,
        type: input.type,
        priority: input.priority ?? null,
        notes: input.notes ?? null,
      })
      .onConflictDoUpdate({
        target: [lifeDomains.lifeGraphId, lifeDomains.type],
        set: {
          ...(input.priority !== undefined ? { priority: input.priority ?? null } : {}),
          ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleLifeDomainRepository: create no devolvió fila.");
    }

    return toLifeDomain(row);
  }

  async update(
    context: LifeGraphContext,
    id: EntityId,
    input: Partial<LifeDomainInput>,
  ): Promise<LifeDomain> {
    const [row] = await this.db
      .update(lifeDomains)
      .set({
        ...(input.priority !== undefined ? { priority: input.priority ?? null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(eq(lifeDomains.id, id), eq(lifeDomains.lifeGraphId, context.lifeGraphId)),
      )
      .returning();

    if (!row) {
      throw new Error(
        `DrizzleLifeDomainRepository: no existe LifeDomain ${id} en este LifeGraph.`,
      );
    }

    return toLifeDomain(row);
  }

  async delete(context: LifeGraphContext, id: EntityId): Promise<void> {
    await this.db
      .delete(lifeDomains)
      .where(
        and(eq(lifeDomains.id, id), eq(lifeDomains.lifeGraphId, context.lifeGraphId)),
      );
  }
}
