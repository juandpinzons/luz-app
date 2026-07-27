import { and, eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { type ImportanceScoreRow, importanceScores } from "../../db/schema";
import type { LifeGraphContext } from "../../life/life-graph-context";
import { type EntityId, createEntityId } from "../../life/value-objects/entity-id";
import type { ImportanceScore } from "../entities/importance-score";
import type { ImportanceRepository } from "./importance.repository";

function toImportanceScore(row: ImportanceScoreRow): ImportanceScore {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    entityType: row.entityType,
    entityId: createEntityId(row.entityId),
    score: row.score,
    reason: row.reason,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleImportanceRepository implements ImportanceRepository {
  constructor(private readonly db: Database) {}

  async getByEntity(
    context: LifeGraphContext,
    entityType: string,
    entityId: EntityId,
  ): Promise<ImportanceScore | null> {
    const rows = await this.db
      .select()
      .from(importanceScores)
      .where(
        and(
          eq(importanceScores.lifeGraphId, context.lifeGraphId),
          eq(importanceScores.entityType, entityType),
          eq(importanceScores.entityId, entityId),
        ),
      )
      .limit(1);

    return rows[0] ? toImportanceScore(rows[0]) : null;
  }

  async list(context: LifeGraphContext): Promise<ImportanceScore[]> {
    const rows = await this.db
      .select()
      .from(importanceScores)
      .where(eq(importanceScores.lifeGraphId, context.lifeGraphId));

    return rows.map(toImportanceScore);
  }

  async save(context: LifeGraphContext, score: ImportanceScore): Promise<ImportanceScore> {
    if (score.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleImportanceRepository.save: score.lifeGraphId (${score.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }

    const [row] = await this.db
      .insert(importanceScores)
      .values({
        id: score.id,
        lifeGraphId: score.lifeGraphId,
        entityType: score.entityType,
        entityId: score.entityId,
        score: score.score,
        reason: score.reason,
        updatedAt: score.updatedAt,
      })
      .onConflictDoUpdate({
        target: [
          importanceScores.lifeGraphId,
          importanceScores.entityType,
          importanceScores.entityId,
        ],
        set: {
          score: score.score,
          reason: score.reason,
          updatedAt: score.updatedAt,
        },
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleImportanceRepository.save: no se pudo persistir.");
    }

    return toImportanceScore(row);
  }
}
