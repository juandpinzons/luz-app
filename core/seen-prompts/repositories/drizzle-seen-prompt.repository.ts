import { and, eq, gte, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { seenPrompts } from "../../db/schema";
import type { LifeGraphContext } from "../../life/life-graph-context";
import { type EntityId, createEntityId } from "../../life/value-objects/entity-id";
import type { SeenPromptRepository } from "./seen-prompt.repository";

export class DrizzleSeenPromptRepository implements SeenPromptRepository {
  constructor(private readonly db: Database) {}

  async listSeenSubjectIds(
    context: LifeGraphContext,
    subjectType: string,
  ): Promise<Set<EntityId>> {
    const rows = await this.db
      .select({ subjectId: seenPrompts.subjectId })
      .from(seenPrompts)
      .where(
        and(
          eq(seenPrompts.lifeGraphId, context.lifeGraphId),
          eq(seenPrompts.subjectType, subjectType),
        ),
      );

    return new Set(rows.map((row) => createEntityId(row.subjectId)));
  }

  async listSeenSubjectIdsSince(
    context: LifeGraphContext,
    subjectType: string,
    since: Date,
  ): Promise<Set<EntityId>> {
    const rows = await this.db
      .select({ subjectId: seenPrompts.subjectId })
      .from(seenPrompts)
      .where(
        and(
          eq(seenPrompts.lifeGraphId, context.lifeGraphId),
          eq(seenPrompts.subjectType, subjectType),
          gte(seenPrompts.firstSeenAt, since),
        ),
      );

    return new Set(rows.map((row) => createEntityId(row.subjectId)));
  }

  async markSeen(
    context: LifeGraphContext,
    subjectType: string,
    subjectId: EntityId,
  ): Promise<void> {
    await this.db
      .insert(seenPrompts)
      .values({
        lifeGraphId: context.lifeGraphId,
        subjectType,
        subjectId,
      })
      .onConflictDoNothing({
        target: [seenPrompts.lifeGraphId, seenPrompts.subjectType, seenPrompts.subjectId],
      });
  }

  async markSeenAgain(
    context: LifeGraphContext,
    subjectType: string,
    subjectId: EntityId,
  ): Promise<void> {
    await this.db
      .insert(seenPrompts)
      .values({
        lifeGraphId: context.lifeGraphId,
        subjectType,
        subjectId,
      })
      .onConflictDoUpdate({
        target: [seenPrompts.lifeGraphId, seenPrompts.subjectType, seenPrompts.subjectId],
        set: { firstSeenAt: sql`now()` },
      });
  }
}
