import { and, eq, or } from "drizzle-orm";
import type { Database } from "../../db/client";
import { type ContradictionRow, contradictions } from "../../db/schema";
import type { LifeGraphContext } from "../../life/life-graph-context";
import { type EntityId, createEntityId } from "../../life/value-objects/entity-id";
import type { Contradiction, ContradictionRef } from "../entities/contradiction";
import type { ContradictionRepository } from "./contradiction.repository";

function toContradiction(row: ContradictionRow): Contradiction {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    kind: row.kind,
    left: { refType: row.leftRefType, refId: createEntityId(row.leftRefId) },
    right: { refType: row.rightRefType, refId: createEntityId(row.rightRefId) },
    description: row.description,
    domain: row.domain ?? undefined,
    status: row.status,
    resolutionNote: row.resolutionNote ?? undefined,
    detectedAt: row.detectedAt,
    resolvedAt: row.resolvedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleContradictionRepository implements ContradictionRepository {
  constructor(private readonly db: Database) {}

  async getById(context: LifeGraphContext, id: EntityId): Promise<Contradiction | null> {
    const rows = await this.db
      .select()
      .from(contradictions)
      .where(
        and(eq(contradictions.id, id), eq(contradictions.lifeGraphId, context.lifeGraphId)),
      )
      .limit(1);

    return rows[0] ? toContradiction(rows[0]) : null;
  }

  async list(context: LifeGraphContext): Promise<Contradiction[]> {
    const rows = await this.db
      .select()
      .from(contradictions)
      .where(eq(contradictions.lifeGraphId, context.lifeGraphId));

    return rows.map(toContradiction);
  }

  async listByRef(
    context: LifeGraphContext,
    ref: ContradictionRef,
  ): Promise<Contradiction[]> {
    const rows = await this.db
      .select()
      .from(contradictions)
      .where(
        and(
          eq(contradictions.lifeGraphId, context.lifeGraphId),
          or(
            and(
              eq(contradictions.leftRefType, ref.refType),
              eq(contradictions.leftRefId, ref.refId),
            ),
            and(
              eq(contradictions.rightRefType, ref.refType),
              eq(contradictions.rightRefId, ref.refId),
            ),
          ),
        ),
      );

    return rows.map(toContradiction);
  }

  async save(
    context: LifeGraphContext,
    contradiction: Contradiction,
  ): Promise<Contradiction> {
    if (contradiction.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleContradictionRepository.save: contradiction.lifeGraphId (${contradiction.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }

    const [row] = await this.db
      .insert(contradictions)
      .values({
        id: contradiction.id,
        lifeGraphId: contradiction.lifeGraphId,
        kind: contradiction.kind,
        leftRefType: contradiction.left.refType,
        leftRefId: contradiction.left.refId,
        rightRefType: contradiction.right.refType,
        rightRefId: contradiction.right.refId,
        description: contradiction.description,
        domain: contradiction.domain ?? null,
        status: contradiction.status,
        resolutionNote: contradiction.resolutionNote ?? null,
        detectedAt: contradiction.detectedAt,
        resolvedAt: contradiction.resolvedAt ?? null,
        createdAt: contradiction.createdAt,
        updatedAt: contradiction.updatedAt,
      })
      .onConflictDoUpdate({
        target: contradictions.id,
        set: {
          description: contradiction.description,
          status: contradiction.status,
          resolutionNote: contradiction.resolutionNote ?? null,
          resolvedAt: contradiction.resolvedAt ?? null,
          updatedAt: contradiction.updatedAt,
        },
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleContradictionRepository.save: no se pudo persistir.");
    }

    return toContradiction(row);
  }
}
