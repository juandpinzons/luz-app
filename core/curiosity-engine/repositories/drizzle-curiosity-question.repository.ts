import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { type CuriosityQuestionRow, curiosityQuestions } from "../../db/schema";
import type { LifeGraphContext } from "../../life/life-graph-context";
import { type EntityId, createEntityId } from "../../life/value-objects/entity-id";
import type { CuriosityQuestion } from "../entities/curiosity-question";
import type { CuriosityQuestionRepository } from "./curiosity-question.repository";

function toCuriosityQuestion(row: CuriosityQuestionRow): CuriosityQuestion {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    domain: row.domain,
    question: row.question,
    rationale: row.rationale,
    status: row.status,
    coverageScoreAtCreation: row.coverageScoreAtCreation,
    timesOffered: row.timesOffered,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt ?? undefined,
  };
}

export class DrizzleCuriosityQuestionRepository implements CuriosityQuestionRepository {
  constructor(private readonly db: Database) {}

  async list(context: LifeGraphContext): Promise<CuriosityQuestion[]> {
    const rows = await this.db
      .select()
      .from(curiosityQuestions)
      .where(eq(curiosityQuestions.lifeGraphId, context.lifeGraphId));

    return rows.map(toCuriosityQuestion);
  }

  async getPending(context: LifeGraphContext): Promise<CuriosityQuestion | null> {
    const rows = await this.db
      .select()
      .from(curiosityQuestions)
      .where(
        and(
          eq(curiosityQuestions.lifeGraphId, context.lifeGraphId),
          eq(curiosityQuestions.status, "pending"),
        ),
      )
      .orderBy(curiosityQuestions.createdAt)
      .limit(1);

    return rows[0] ? toCuriosityQuestion(rows[0]) : null;
  }

  async save(
    context: LifeGraphContext,
    question: CuriosityQuestion,
  ): Promise<CuriosityQuestion> {
    if (question.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleCuriosityQuestionRepository.save: question.lifeGraphId (${question.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }

    const [row] = await this.db
      .insert(curiosityQuestions)
      .values({
        id: question.id,
        lifeGraphId: question.lifeGraphId,
        domain: question.domain,
        question: question.question,
        rationale: question.rationale,
        status: question.status,
        coverageScoreAtCreation: question.coverageScoreAtCreation,
        timesOffered: question.timesOffered,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
        resolvedAt: question.resolvedAt ?? null,
      })
      .onConflictDoUpdate({
        target: curiosityQuestions.id,
        set: {
          status: question.status,
          timesOffered: question.timesOffered,
          updatedAt: question.updatedAt,
          resolvedAt: question.resolvedAt ?? null,
        },
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleCuriosityQuestionRepository.save: no se pudo persistir.");
    }

    return toCuriosityQuestion(row);
  }

  async updateStatus(
    context: LifeGraphContext,
    id: EntityId,
    status: "resolved" | "dismissed",
    resolvedAt: Date,
  ): Promise<void> {
    await this.db
      .update(curiosityQuestions)
      .set({ status, resolvedAt, updatedAt: resolvedAt })
      .where(
        and(
          eq(curiosityQuestions.id, id),
          eq(curiosityQuestions.lifeGraphId, context.lifeGraphId),
        ),
      );
  }

  async incrementTimesOffered(context: LifeGraphContext, id: EntityId): Promise<number> {
    const [row] = await this.db
      .update(curiosityQuestions)
      .set({ timesOffered: sql`${curiosityQuestions.timesOffered} + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(curiosityQuestions.id, id),
          eq(curiosityQuestions.lifeGraphId, context.lifeGraphId),
        ),
      )
      .returning({ timesOffered: curiosityQuestions.timesOffered });

    return row?.timesOffered ?? 0;
  }
}
