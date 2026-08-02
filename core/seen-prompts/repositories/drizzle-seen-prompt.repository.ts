import { and, eq } from "drizzle-orm";
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
}
