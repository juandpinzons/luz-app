import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../../db/client";
import {
  type KnowledgeEngineReasoningConclusionRow,
  type KnowledgeEngineReasoningEvidenceRow,
  knowledgeEngineReasoningConclusions,
  knowledgeEngineReasoningEvidence,
} from "../../../db/schema";
import type { LifeGraphContext } from "../../../life/life-graph-context";
import { type EntityId, createEntityId } from "../../../life/value-objects/entity-id";
import { decryptContent, encryptContent } from "../../../security/content-cipher";
import type { ReasoningConclusion } from "../entities/reasoning-conclusion";
import type { ReasoningEvidence, ReasoningEvidenceRef } from "../entities/reasoning-evidence";
import type { ReasoningRepository } from "./reasoning.repository";

function toConclusion(row: KnowledgeEngineReasoningConclusionRow): ReasoningConclusion {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    statement: decryptContent(row.statement),
    confidence: {
      score: row.confidenceScore,
      assignedAt: row.confidenceAssignedAt,
    },
    status: row.status,
    uncertaintyNotes: row.uncertaintyNotes.map(decryptContent),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toEvidence(row: KnowledgeEngineReasoningEvidenceRow): ReasoningEvidence {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    conclusionId: createEntityId(row.conclusionId),
    ref: {
      refType: row.refType,
      refId: createEntityId(row.refId),
      role: row.role,
    },
    createdAt: row.createdAt,
  };
}

/**
 * CRUD escopado por LifeGraphContext -- mismo patrón que
 * `DrizzleInsightRepository`. `save()` es upsert (`onConflictDoUpdate`
 * sobre `id`).
 */
export class DrizzleReasoningRepository implements ReasoningRepository {
  constructor(private readonly db: Database) {}

  async getById(
    context: LifeGraphContext,
    id: EntityId,
  ): Promise<ReasoningConclusion | null> {
    const rows = await this.db
      .select()
      .from(knowledgeEngineReasoningConclusions)
      .where(
        and(
          eq(knowledgeEngineReasoningConclusions.id, id),
          eq(knowledgeEngineReasoningConclusions.lifeGraphId, context.lifeGraphId),
        ),
      )
      .limit(1);

    return rows[0] ? toConclusion(rows[0]) : null;
  }

  async list(context: LifeGraphContext): Promise<ReasoningConclusion[]> {
    const rows = await this.db
      .select()
      .from(knowledgeEngineReasoningConclusions)
      .where(eq(knowledgeEngineReasoningConclusions.lifeGraphId, context.lifeGraphId));

    return rows.map(toConclusion);
  }

  async save(
    context: LifeGraphContext,
    conclusion: ReasoningConclusion,
  ): Promise<ReasoningConclusion> {
    if (conclusion.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleReasoningRepository.save: conclusion.lifeGraphId (${conclusion.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }

    const [row] = await this.db
      .insert(knowledgeEngineReasoningConclusions)
      .values({
        id: conclusion.id,
        lifeGraphId: conclusion.lifeGraphId,
        statement: encryptContent(conclusion.statement),
        confidenceScore: conclusion.confidence.score,
        confidenceAssignedAt: conclusion.confidence.assignedAt,
        status: conclusion.status,
        uncertaintyNotes: conclusion.uncertaintyNotes.map(encryptContent),
        createdAt: conclusion.createdAt,
        updatedAt: conclusion.updatedAt,
      })
      .onConflictDoUpdate({
        target: knowledgeEngineReasoningConclusions.id,
        set: {
          statement: encryptContent(conclusion.statement),
          confidenceScore: conclusion.confidence.score,
          confidenceAssignedAt: conclusion.confidence.assignedAt,
          status: conclusion.status,
          uncertaintyNotes: conclusion.uncertaintyNotes.map(encryptContent),
          updatedAt: conclusion.updatedAt,
        },
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleReasoningRepository.save: no se pudo persistir.");
    }

    return toConclusion(row);
  }

  async getEvidence(
    context: LifeGraphContext,
    conclusionId: EntityId,
  ): Promise<ReasoningEvidence[]> {
    const rows = await this.db
      .select()
      .from(knowledgeEngineReasoningEvidence)
      .where(
        and(
          eq(knowledgeEngineReasoningEvidence.lifeGraphId, context.lifeGraphId),
          eq(knowledgeEngineReasoningEvidence.conclusionId, conclusionId),
        ),
      );

    return rows.map(toEvidence);
  }

  async saveEvidence(
    context: LifeGraphContext,
    conclusionId: EntityId,
    ref: ReasoningEvidenceRef,
  ): Promise<ReasoningEvidence> {
    const [row] = await this.db
      .insert(knowledgeEngineReasoningEvidence)
      .values({
        lifeGraphId: context.lifeGraphId,
        conclusionId,
        refType: ref.refType,
        refId: ref.refId,
        role: ref.role,
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleReasoningRepository.saveEvidence: no se pudo persistir.");
    }

    return toEvidence(row);
  }

  async listByEvidenceRef(
    context: LifeGraphContext,
    refType: string,
    refId: EntityId,
  ): Promise<ReasoningConclusion[]> {
    const evidenceRows = await this.db
      .select({ conclusionId: knowledgeEngineReasoningEvidence.conclusionId })
      .from(knowledgeEngineReasoningEvidence)
      .where(
        and(
          eq(knowledgeEngineReasoningEvidence.lifeGraphId, context.lifeGraphId),
          eq(knowledgeEngineReasoningEvidence.refType, refType),
          eq(knowledgeEngineReasoningEvidence.refId, refId),
        ),
      );

    const conclusionIds = [...new Set(evidenceRows.map((row) => row.conclusionId))];
    if (conclusionIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(knowledgeEngineReasoningConclusions)
      .where(
        and(
          eq(knowledgeEngineReasoningConclusions.lifeGraphId, context.lifeGraphId),
          inArray(knowledgeEngineReasoningConclusions.id, conclusionIds),
        ),
      );

    return rows.map(toConclusion);
  }
}
