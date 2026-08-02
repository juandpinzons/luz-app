import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "../../db/client";
import {
  type BeliefEvidenceRow,
  type BeliefHistoryRow,
  type BeliefRow,
  beliefEvidence,
  beliefHistory,
  beliefs,
} from "../../db/schema";
import type { LifeGraphContext } from "../../life/life-graph-context";
import { type EntityId, createEntityId } from "../../life/value-objects/entity-id";
import type { BeliefEvidence } from "../entities/belief-evidence";
import type { BeliefEvidenceWithStatus } from "../entities/belief-evidence-with-status";
import type { BeliefHistoryEntry } from "../entities/belief-history-entry";
import type { Belief } from "../entities/belief";
import type { BeliefRepository } from "./belief.repository";

function toBelief(row: BeliefRow): Belief {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    subjectPersonId: createEntityId(row.subjectPersonId),
    statement: row.statement,
    domain: row.domain ?? undefined,
    category: row.category,
    status: row.status,
    confidence: {
      score: row.confidenceScore,
      assignedAt: row.confidenceAssignedAt,
    },
    firstObservedAt: row.firstObservedAt,
    lastReinforcedAt: row.lastReinforcedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toBeliefEvidence(row: BeliefEvidenceRow): BeliefEvidence {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    beliefId: createEntityId(row.beliefId),
    insightId: row.insightId ? createEntityId(row.insightId) : undefined,
    memoryId: row.memoryId ? createEntityId(row.memoryId) : undefined,
    createdAt: row.createdAt,
  };
}

function toBeliefHistoryEntry(row: BeliefHistoryRow): BeliefHistoryEntry {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    beliefId: createEntityId(row.beliefId),
    previousConfidence: row.previousConfidence ?? undefined,
    newConfidence: row.newConfidence,
    changeReason: row.changeReason,
    changedAt: row.changedAt,
  };
}

export class DrizzleBeliefRepository implements BeliefRepository {
  constructor(private readonly db: Database) {}

  async getById(context: LifeGraphContext, id: EntityId): Promise<Belief | null> {
    const rows = await this.db
      .select()
      .from(beliefs)
      .where(and(eq(beliefs.id, id), eq(beliefs.lifeGraphId, context.lifeGraphId)))
      .limit(1);

    return rows[0] ? toBelief(rows[0]) : null;
  }

  async list(context: LifeGraphContext): Promise<Belief[]> {
    const rows = await this.db
      .select()
      .from(beliefs)
      .where(eq(beliefs.lifeGraphId, context.lifeGraphId));

    return rows.map(toBelief);
  }

  async listActive(context: LifeGraphContext): Promise<Belief[]> {
    const rows = await this.db
      .select()
      .from(beliefs)
      .where(
        and(eq(beliefs.lifeGraphId, context.lifeGraphId), eq(beliefs.status, "active")),
      );

    return rows.map(toBelief);
  }

  async save(context: LifeGraphContext, belief: Belief): Promise<Belief> {
    if (belief.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleBeliefRepository.save: belief.lifeGraphId (${belief.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }

    const [row] = await this.db
      .insert(beliefs)
      .values({
        id: belief.id,
        lifeGraphId: belief.lifeGraphId,
        subjectPersonId: belief.subjectPersonId,
        statement: belief.statement,
        domain: belief.domain ?? null,
        category: belief.category,
        status: belief.status,
        confidenceScore: belief.confidence.score,
        confidenceAssignedAt: belief.confidence.assignedAt,
        firstObservedAt: belief.firstObservedAt,
        lastReinforcedAt: belief.lastReinforcedAt,
        createdAt: belief.createdAt,
        updatedAt: belief.updatedAt,
      })
      .onConflictDoUpdate({
        target: beliefs.id,
        set: {
          statement: belief.statement,
          domain: belief.domain ?? null,
          category: belief.category,
          status: belief.status,
          confidenceScore: belief.confidence.score,
          confidenceAssignedAt: belief.confidence.assignedAt,
          lastReinforcedAt: belief.lastReinforcedAt,
          updatedAt: belief.updatedAt,
        },
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleBeliefRepository.save: no se pudo persistir.");
    }

    return toBelief(row);
  }

  async getEvidence(
    context: LifeGraphContext,
    beliefId: EntityId,
  ): Promise<BeliefEvidence[]> {
    const rows = await this.db
      .select()
      .from(beliefEvidence)
      .where(
        and(
          eq(beliefEvidence.lifeGraphId, context.lifeGraphId),
          eq(beliefEvidence.beliefId, beliefId),
        ),
      );

    return rows.map(toBeliefEvidence);
  }

  async saveEvidence(
    context: LifeGraphContext,
    evidence: BeliefEvidence,
  ): Promise<BeliefEvidence> {
    if (evidence.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleBeliefRepository.saveEvidence: evidence.lifeGraphId (${evidence.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }

    const [row] = await this.db
      .insert(beliefEvidence)
      .values({
        id: evidence.id,
        lifeGraphId: evidence.lifeGraphId,
        beliefId: evidence.beliefId,
        insightId: evidence.insightId ?? null,
        memoryId: evidence.memoryId ?? null,
        createdAt: evidence.createdAt,
      })
      .onConflictDoUpdate({
        target: beliefEvidence.id,
        set: {
          insightId: evidence.insightId ?? null,
          memoryId: evidence.memoryId ?? null,
        },
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleBeliefRepository.saveEvidence: no se pudo persistir.");
    }

    return toBeliefEvidence(row);
  }

  async listEvidenceWithStatus(
    context: LifeGraphContext,
  ): Promise<BeliefEvidenceWithStatus[]> {
    const rows = await this.db
      .select({
        memoryId: beliefEvidence.memoryId,
        insightId: beliefEvidence.insightId,
        beliefStatus: beliefs.status,
      })
      .from(beliefEvidence)
      .innerJoin(beliefs, eq(beliefEvidence.beliefId, beliefs.id))
      .where(eq(beliefEvidence.lifeGraphId, context.lifeGraphId));

    return rows.map((row) => ({
      memoryId: row.memoryId ? createEntityId(row.memoryId) : null,
      insightId: row.insightId ? createEntityId(row.insightId) : null,
      beliefStatus: row.beliefStatus,
    }));
  }

  async getHistory(
    context: LifeGraphContext,
    beliefId: EntityId,
  ): Promise<BeliefHistoryEntry[]> {
    const rows = await this.db
      .select()
      .from(beliefHistory)
      .where(
        and(
          eq(beliefHistory.lifeGraphId, context.lifeGraphId),
          eq(beliefHistory.beliefId, beliefId),
        ),
      )
      .orderBy(asc(beliefHistory.changedAt));

    return rows.map(toBeliefHistoryEntry);
  }

  async getHistoryForBeliefs(
    context: LifeGraphContext,
    beliefIds: readonly EntityId[],
  ): Promise<BeliefHistoryEntry[]> {
    if (beliefIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(beliefHistory)
      .where(
        and(
          eq(beliefHistory.lifeGraphId, context.lifeGraphId),
          inArray(beliefHistory.beliefId, beliefIds as EntityId[]),
        ),
      )
      .orderBy(asc(beliefHistory.changedAt));

    return rows.map(toBeliefHistoryEntry);
  }

  async appendHistory(
    context: LifeGraphContext,
    entry: BeliefHistoryEntry,
  ): Promise<BeliefHistoryEntry> {
    if (entry.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleBeliefRepository.appendHistory: entry.lifeGraphId (${entry.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }

    const [row] = await this.db
      .insert(beliefHistory)
      .values({
        id: entry.id,
        lifeGraphId: entry.lifeGraphId,
        beliefId: entry.beliefId,
        previousConfidence: entry.previousConfidence ?? null,
        newConfidence: entry.newConfidence,
        changeReason: entry.changeReason,
        changedAt: entry.changedAt,
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleBeliefRepository.appendHistory: no se pudo persistir.");
    }

    return toBeliefHistoryEntry(row);
  }

  async saveWithHistory(
    context: LifeGraphContext,
    belief: Belief,
    entry: BeliefHistoryEntry,
  ): Promise<Belief> {
    if (belief.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleBeliefRepository.saveWithHistory: belief.lifeGraphId (${belief.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }
    if (entry.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleBeliefRepository.saveWithHistory: entry.lifeGraphId (${entry.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }

    return this.db.transaction(async (tx) => {
      const [beliefRow] = await tx
        .insert(beliefs)
        .values({
          id: belief.id,
          lifeGraphId: belief.lifeGraphId,
          subjectPersonId: belief.subjectPersonId,
          statement: belief.statement,
          domain: belief.domain ?? null,
          category: belief.category,
          status: belief.status,
          confidenceScore: belief.confidence.score,
          confidenceAssignedAt: belief.confidence.assignedAt,
          firstObservedAt: belief.firstObservedAt,
          lastReinforcedAt: belief.lastReinforcedAt,
          createdAt: belief.createdAt,
          updatedAt: belief.updatedAt,
        })
        .onConflictDoUpdate({
          target: beliefs.id,
          set: {
            statement: belief.statement,
            domain: belief.domain ?? null,
            category: belief.category,
            status: belief.status,
            confidenceScore: belief.confidence.score,
            confidenceAssignedAt: belief.confidence.assignedAt,
            lastReinforcedAt: belief.lastReinforcedAt,
            updatedAt: belief.updatedAt,
          },
        })
        .returning();

      if (!beliefRow) {
        throw new Error("DrizzleBeliefRepository.saveWithHistory: no se pudo persistir el belief.");
      }

      const [historyRow] = await tx
        .insert(beliefHistory)
        .values({
          id: entry.id,
          lifeGraphId: entry.lifeGraphId,
          beliefId: entry.beliefId,
          previousConfidence: entry.previousConfidence ?? null,
          newConfidence: entry.newConfidence,
          changeReason: entry.changeReason,
          changedAt: entry.changedAt,
        })
        .returning();

      if (!historyRow) {
        throw new Error("DrizzleBeliefRepository.saveWithHistory: no se pudo persistir el historial.");
      }

      return toBelief(beliefRow);
    });
  }
}
