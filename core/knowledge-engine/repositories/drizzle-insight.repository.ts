import { and, eq, or } from "drizzle-orm";
import type { Database } from "../../db/client";
import {
  type KnowledgeEngineEvidenceRow,
  type KnowledgeEngineInsightRelationshipRow,
  type KnowledgeEngineInsightRow,
  knowledgeEngineEvidence,
  knowledgeEngineInsightRelationships,
  knowledgeEngineInsights,
} from "../../db/schema";
import type { LifeGraphContext } from "../../life/life-graph-context";
import {
  type EntityId,
  createEntityId,
} from "../../life/value-objects/entity-id";
import type { Evidence } from "../entities/evidence";
import type { Insight } from "../entities/insight";
import type { InsightRelationship } from "../entities/insight-relationship";
import type { InsightRepository } from "./insight.repository";

function toInsight(row: KnowledgeEngineInsightRow): Insight {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    type: row.type,
    description: row.description,
    confidence: {
      score: row.confidenceScore,
      assignedAt: row.confidenceAssignedAt,
    },
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    validatedAt: row.validatedAt ?? undefined,
  };
}

function toEvidence(row: KnowledgeEngineEvidenceRow): Evidence {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    insightId: createEntityId(row.insightId),
    memoryId: createEntityId(row.memoryId),
    createdAt: row.createdAt,
  };
}

function toInsightRelationship(
  row: KnowledgeEngineInsightRelationshipRow,
): InsightRelationship {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    fromInsightId: createEntityId(row.fromInsightId),
    toInsightId: createEntityId(row.toInsightId),
    relationType: row.relationType,
    strength: row.strength ?? undefined,
    createdAt: row.createdAt,
  };
}

/**
 * Solo persiste y recupera — misma disciplina que
 * `DrizzleMemoryRepository`. `save()`/`saveEvidence()`/`saveRelationship()`
 * son upsert (`onConflictDoUpdate` sobre `id`), a propósito: como ya
 * quedó documentado en `insight.repository.ts` antes de este PR, un
 * `Insight` no es inmutable — recalcular confianza, cambiar `status`
 * (invalidar, y algún día archivar), o corregir una descripción es
 * volver a llamar `save()` con el mismo `id`, sin ningún método nuevo.
 *
 * `delete()` es borrado real, sin ninguna semántica de "invalidado" —
 * esa distinción vive en el propio contrato, no aquí (mismo principio
 * que `DrizzleMemoryRepository.delete()` frente a `ForgetStage`).
 *
 * `evidence.memoryId` se persiste tal cual llega, sin `references()` en
 * el schema (ver `core/db/schema/knowledge-engine.ts`) — este
 * repositorio tampoco asume que sea siempre un `EntityId` de Memory;
 * simplemente lo guarda y lo devuelve.
 */
export class DrizzleInsightRepository implements InsightRepository {
  constructor(private readonly db: Database) {}

  async getById(
    context: LifeGraphContext,
    id: EntityId,
  ): Promise<Insight | null> {
    const rows = await this.db
      .select()
      .from(knowledgeEngineInsights)
      .where(
        and(
          eq(knowledgeEngineInsights.id, id),
          eq(knowledgeEngineInsights.lifeGraphId, context.lifeGraphId),
        ),
      )
      .limit(1);

    return rows[0] ? toInsight(rows[0]) : null;
  }

  async list(context: LifeGraphContext): Promise<Insight[]> {
    const rows = await this.db
      .select()
      .from(knowledgeEngineInsights)
      .where(eq(knowledgeEngineInsights.lifeGraphId, context.lifeGraphId));

    return rows.map(toInsight);
  }

  /**
   * Upsert. `insight.lifeGraphId` debe coincidir con
   * `context.lifeGraphId` — una discrepancia no se corrige en
   * silencio, es un error del llamador y se rechaza (mismo criterio
   * que `DrizzleMemoryRepository.save()`).
   */
  async save(context: LifeGraphContext, insight: Insight): Promise<Insight> {
    if (insight.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleInsightRepository.save: insight.lifeGraphId (${insight.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }

    const [row] = await this.db
      .insert(knowledgeEngineInsights)
      .values({
        id: insight.id,
        lifeGraphId: insight.lifeGraphId,
        type: insight.type,
        description: insight.description,
        confidenceScore: insight.confidence.score,
        confidenceAssignedAt: insight.confidence.assignedAt,
        status: insight.status,
        createdAt: insight.createdAt,
        updatedAt: insight.updatedAt,
        validatedAt: insight.validatedAt ?? null,
      })
      .onConflictDoUpdate({
        target: knowledgeEngineInsights.id,
        set: {
          type: insight.type,
          description: insight.description,
          confidenceScore: insight.confidence.score,
          confidenceAssignedAt: insight.confidence.assignedAt,
          status: insight.status,
          updatedAt: insight.updatedAt,
          validatedAt: insight.validatedAt ?? null,
        },
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleInsightRepository.save: no se pudo persistir.");
    }

    return toInsight(row);
  }

  async delete(context: LifeGraphContext, id: EntityId): Promise<void> {
    await this.db
      .delete(knowledgeEngineInsights)
      .where(
        and(
          eq(knowledgeEngineInsights.id, id),
          eq(knowledgeEngineInsights.lifeGraphId, context.lifeGraphId),
        ),
      );
  }

  async getEvidence(
    context: LifeGraphContext,
    insightId: EntityId,
  ): Promise<Evidence[]> {
    const rows = await this.db
      .select()
      .from(knowledgeEngineEvidence)
      .where(
        and(
          eq(knowledgeEngineEvidence.lifeGraphId, context.lifeGraphId),
          eq(knowledgeEngineEvidence.insightId, insightId),
        ),
      );

    return rows.map(toEvidence);
  }

  async saveEvidence(
    context: LifeGraphContext,
    evidence: Evidence,
  ): Promise<Evidence> {
    if (evidence.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleInsightRepository.saveEvidence: evidence.lifeGraphId (${evidence.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }

    const [row] = await this.db
      .insert(knowledgeEngineEvidence)
      .values({
        id: evidence.id,
        lifeGraphId: evidence.lifeGraphId,
        insightId: evidence.insightId,
        memoryId: evidence.memoryId,
        createdAt: evidence.createdAt,
      })
      .onConflictDoUpdate({
        target: knowledgeEngineEvidence.id,
        set: {
          insightId: evidence.insightId,
          memoryId: evidence.memoryId,
        },
      })
      .returning();

    if (!row) {
      throw new Error(
        "DrizzleInsightRepository.saveEvidence: no se pudo persistir.",
      );
    }

    return toEvidence(row);
  }

  /**
   * Relaciones donde `insightId` participa en cualquiera de los dos
   * extremos — mismo criterio que `DrizzleMemoryRepository.getConnections()`.
   */
  async getRelationships(
    context: LifeGraphContext,
    insightId: EntityId,
  ): Promise<InsightRelationship[]> {
    const rows = await this.db
      .select()
      .from(knowledgeEngineInsightRelationships)
      .where(
        and(
          eq(
            knowledgeEngineInsightRelationships.lifeGraphId,
            context.lifeGraphId,
          ),
          or(
            eq(knowledgeEngineInsightRelationships.fromInsightId, insightId),
            eq(knowledgeEngineInsightRelationships.toInsightId, insightId),
          ),
        ),
      );

    return rows.map(toInsightRelationship);
  }

  async saveRelationship(
    context: LifeGraphContext,
    relationship: InsightRelationship,
  ): Promise<InsightRelationship> {
    if (relationship.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleInsightRepository.saveRelationship: relationship.lifeGraphId (${relationship.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }

    const [row] = await this.db
      .insert(knowledgeEngineInsightRelationships)
      .values({
        id: relationship.id,
        lifeGraphId: relationship.lifeGraphId,
        fromInsightId: relationship.fromInsightId,
        toInsightId: relationship.toInsightId,
        relationType: relationship.relationType,
        strength: relationship.strength ?? null,
        createdAt: relationship.createdAt,
      })
      .onConflictDoUpdate({
        target: knowledgeEngineInsightRelationships.id,
        set: {
          relationType: relationship.relationType,
          strength: relationship.strength ?? null,
        },
      })
      .returning();

    if (!row) {
      throw new Error(
        "DrizzleInsightRepository.saveRelationship: no se pudo persistir.",
      );
    }

    return toInsightRelationship(row);
  }
}
