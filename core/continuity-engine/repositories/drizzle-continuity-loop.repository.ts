import { and, asc, eq, inArray, isNotNull, lte } from "drizzle-orm";
import type { Database } from "../../db/client";
import {
  type ContinuityLoopHistoryRow,
  type ContinuityLoopRow,
  continuityLoopHistory,
  continuityLoops,
} from "../../db/schema";
import type { LifeGraphContext } from "../../life/life-graph-context";
import { type EntityId, createEntityId } from "../../life/value-objects/entity-id";
import type { ContinuityLoop, LoopResolution, LoopTransitionRecord } from "../domain/continuity-loop";
import { isTerminalLoopState, type LoopState } from "../domain/loop-state";
import type { ContinuityLoopRepository } from "./continuity-loop.repository";

function toLoop(row: ContinuityLoopRow): ContinuityLoop {
  const resolution: LoopResolution | undefined = row.resolvedAt
    ? {
        state: row.state,
        resolvedAt: row.resolvedAt,
        evidence: {
          kind: row.resolutionEvidenceKind!,
          observedAt: row.resolvedAt,
          description: row.resolutionEvidenceDescription!,
          sourceId: row.resolutionEvidenceSourceId ?? undefined,
        },
        outcome:
          row.outcomeKind && row.outcomeSummary
            ? { kind: row.outcomeKind, summary: row.outcomeSummary, capturedAt: row.resolvedAt }
            : undefined,
        transformedIntoLoopId: row.transformedIntoLoopId ? createEntityId(row.transformedIntoLoopId) : undefined,
      }
    : undefined;

  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    trigger: {
      origin: row.origin,
      reason: row.reason,
      sourceId: row.triggerSourceId,
      detectedAt: row.triggerDetectedAt,
      summary: row.triggerSummary,
    },
    title: row.title,
    state: row.state,
    priority: row.priority,
    resolution,
    nextFollowUpAt: row.nextFollowUpAt ?? undefined,
    followUpAttempts: row.followUpAttempts,
    relatedEntities: row.relatedEntities,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toTransitionRecord(row: ContinuityLoopHistoryRow): LoopTransitionRecord {
  return {
    id: createEntityId(row.id),
    loopId: createEntityId(row.loopId),
    lifeGraphId: createEntityId(row.lifeGraphId),
    fromState: row.fromState ?? undefined,
    toState: row.toState,
    evidence: {
      kind: row.evidenceKind,
      observedAt: row.occurredAt,
      description: row.evidenceDescription,
      sourceId: row.evidenceSourceId ?? undefined,
    },
    occurredAt: row.occurredAt,
  };
}

/**
 * Persistencia real de `ContinuityLoop` -- mismo patrón que
 * `DrizzleBeliefRepository`: `save()` es upsert por `id`, rechaza
 * (lanza) una discrepancia de `lifeGraphId` en vez de corregirla en
 * silencio, `getHistory`/`appendTransition` son la traza append-only
 * separada del aggregate root (ver docblock de `LoopEvidence`, dominio).
 */
export class DrizzleContinuityLoopRepository implements ContinuityLoopRepository {
  constructor(private readonly db: Database) {}

  async getById(context: LifeGraphContext, id: EntityId): Promise<ContinuityLoop | null> {
    const rows = await this.db
      .select()
      .from(continuityLoops)
      .where(and(eq(continuityLoops.id, id), eq(continuityLoops.lifeGraphId, context.lifeGraphId)))
      .limit(1);

    return rows[0] ? toLoop(rows[0]) : null;
  }

  async list(context: LifeGraphContext): Promise<ContinuityLoop[]> {
    const rows = await this.db.select().from(continuityLoops).where(eq(continuityLoops.lifeGraphId, context.lifeGraphId));
    return rows.map(toLoop);
  }

  async listByState(context: LifeGraphContext, states: readonly LoopState[]): Promise<ContinuityLoop[]> {
    if (states.length === 0) return [];

    const rows = await this.db
      .select()
      .from(continuityLoops)
      .where(and(eq(continuityLoops.lifeGraphId, context.lifeGraphId), inArray(continuityLoops.state, [...states])));

    return rows.map(toLoop);
  }

  async listDueForFollowUp(context: LifeGraphContext, now: Date): Promise<ContinuityLoop[]> {
    const rows = await this.db
      .select()
      .from(continuityLoops)
      .where(
        and(
          eq(continuityLoops.lifeGraphId, context.lifeGraphId),
          eq(continuityLoops.state, "waiting"),
          isNotNull(continuityLoops.nextFollowUpAt),
          lte(continuityLoops.nextFollowUpAt, now),
        ),
      );

    return rows.map(toLoop);
  }

  async save(context: LifeGraphContext, loop: ContinuityLoop): Promise<ContinuityLoop> {
    if (loop.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleContinuityLoopRepository.save: loop.lifeGraphId (${loop.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }
    if (isTerminalLoopState(loop.state) && !loop.resolution) {
      throw new Error(
        `DrizzleContinuityLoopRepository.save: loop ${loop.id} está en estado terminal "${loop.state}" sin LoopResolution -- estado inconsistente, transitionLoop() nunca debería producir esto.`,
      );
    }

    const [row] = await this.db
      .insert(continuityLoops)
      .values({
        id: loop.id,
        lifeGraphId: loop.lifeGraphId,
        origin: loop.trigger.origin,
        reason: loop.trigger.reason,
        triggerSourceId: loop.trigger.sourceId,
        triggerSummary: loop.trigger.summary,
        triggerDetectedAt: loop.trigger.detectedAt,
        title: loop.title,
        state: loop.state,
        priority: loop.priority,
        relatedEntities: loop.relatedEntities,
        nextFollowUpAt: loop.nextFollowUpAt ?? null,
        followUpAttempts: loop.followUpAttempts,
        resolvedAt: loop.resolution?.resolvedAt ?? null,
        resolutionEvidenceKind: loop.resolution?.evidence.kind ?? null,
        resolutionEvidenceDescription: loop.resolution?.evidence.description ?? null,
        resolutionEvidenceSourceId: loop.resolution?.evidence.sourceId ?? null,
        outcomeKind: loop.resolution?.outcome?.kind ?? null,
        outcomeSummary: loop.resolution?.outcome?.summary ?? null,
        transformedIntoLoopId: loop.resolution?.transformedIntoLoopId ?? null,
        createdAt: loop.createdAt,
        updatedAt: loop.updatedAt,
      })
      .onConflictDoUpdate({
        target: continuityLoops.id,
        set: {
          state: loop.state,
          priority: loop.priority,
          relatedEntities: loop.relatedEntities,
          nextFollowUpAt: loop.nextFollowUpAt ?? null,
          followUpAttempts: loop.followUpAttempts,
          resolvedAt: loop.resolution?.resolvedAt ?? null,
          resolutionEvidenceKind: loop.resolution?.evidence.kind ?? null,
          resolutionEvidenceDescription: loop.resolution?.evidence.description ?? null,
          resolutionEvidenceSourceId: loop.resolution?.evidence.sourceId ?? null,
          outcomeKind: loop.resolution?.outcome?.kind ?? null,
          outcomeSummary: loop.resolution?.outcome?.summary ?? null,
          transformedIntoLoopId: loop.resolution?.transformedIntoLoopId ?? null,
          updatedAt: loop.updatedAt,
        },
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleContinuityLoopRepository.save: no se pudo persistir.");
    }

    return toLoop(row);
  }

  async getHistory(context: LifeGraphContext, loopId: EntityId): Promise<LoopTransitionRecord[]> {
    const rows = await this.db
      .select()
      .from(continuityLoopHistory)
      .where(and(eq(continuityLoopHistory.lifeGraphId, context.lifeGraphId), eq(continuityLoopHistory.loopId, loopId)))
      .orderBy(asc(continuityLoopHistory.occurredAt));

    return rows.map(toTransitionRecord);
  }

  async appendTransition(context: LifeGraphContext, record: LoopTransitionRecord): Promise<LoopTransitionRecord> {
    if (record.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleContinuityLoopRepository.appendTransition: record.lifeGraphId (${record.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }

    const [row] = await this.db
      .insert(continuityLoopHistory)
      .values({
        id: record.id,
        lifeGraphId: record.lifeGraphId,
        loopId: record.loopId,
        fromState: record.fromState ?? null,
        toState: record.toState,
        evidenceKind: record.evidence.kind,
        evidenceDescription: record.evidence.description,
        evidenceSourceId: record.evidence.sourceId ?? null,
        occurredAt: record.occurredAt,
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleContinuityLoopRepository.appendTransition: no se pudo persistir.");
    }

    return toTransitionRecord(row);
  }
}
