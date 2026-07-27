import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import {
  type ConceptEvidenceRow,
  type ConceptRelationRow,
  type ConceptRow,
  conceptEvidence,
  conceptRelations,
  concepts,
} from "../../db/schema";
import type { LifeGraphContext } from "../../life/life-graph-context";
import { type EntityId, createEntityId } from "../../life/value-objects/entity-id";
import type { ConceptEvidence } from "../entities/concept-evidence";
import type { ConceptRelation } from "../entities/concept-relation";
import type { Concept } from "../entities/concept";
import type { ConceptRepository } from "./concept.repository";

function toConcept(row: ConceptRow): Concept {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    label: row.label,
    description: row.description ?? undefined,
    domain: row.domain ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toConceptRelation(row: ConceptRelationRow): ConceptRelation {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    fromConceptId: createEntityId(row.fromConceptId),
    toConceptId: createEntityId(row.toConceptId),
    relationType: row.relationType,
    strength: row.strength ?? undefined,
    createdAt: row.createdAt,
  };
}

function toConceptEvidence(row: ConceptEvidenceRow): ConceptEvidence {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    conceptId: createEntityId(row.conceptId),
    insightId: row.insightId ? createEntityId(row.insightId) : undefined,
    memoryId: createEntityId(row.memoryId),
    createdAt: row.createdAt,
  };
}

export class DrizzleConceptRepository implements ConceptRepository {
  constructor(private readonly db: Database) {}

  async getById(context: LifeGraphContext, id: EntityId): Promise<Concept | null> {
    const rows = await this.db
      .select()
      .from(concepts)
      .where(and(eq(concepts.id, id), eq(concepts.lifeGraphId, context.lifeGraphId)))
      .limit(1);

    return rows[0] ? toConcept(rows[0]) : null;
  }

  async getByLabel(context: LifeGraphContext, label: string): Promise<Concept | null> {
    const normalized = label.trim().toLowerCase();
    const rows = await this.db
      .select()
      .from(concepts)
      .where(
        and(
          eq(concepts.lifeGraphId, context.lifeGraphId),
          eq(sql`lower(${concepts.label})`, normalized),
        ),
      )
      .limit(1);

    return rows[0] ? toConcept(rows[0]) : null;
  }

  async list(context: LifeGraphContext): Promise<Concept[]> {
    const rows = await this.db
      .select()
      .from(concepts)
      .where(eq(concepts.lifeGraphId, context.lifeGraphId));

    return rows.map(toConcept);
  }

  async save(context: LifeGraphContext, concept: Concept): Promise<Concept> {
    if (concept.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleConceptRepository.save: concept.lifeGraphId (${concept.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }

    const [row] = await this.db
      .insert(concepts)
      .values({
        id: concept.id,
        lifeGraphId: concept.lifeGraphId,
        label: concept.label,
        description: concept.description ?? null,
        domain: concept.domain ?? null,
        createdAt: concept.createdAt,
        updatedAt: concept.updatedAt,
      })
      .onConflictDoUpdate({
        target: concepts.id,
        set: {
          label: concept.label,
          description: concept.description ?? null,
          domain: concept.domain ?? null,
          updatedAt: concept.updatedAt,
        },
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleConceptRepository.save: no se pudo persistir.");
    }

    return toConcept(row);
  }

  async listRelations(
    context: LifeGraphContext,
    conceptId: EntityId,
  ): Promise<ConceptRelation[]> {
    const rows = await this.db
      .select()
      .from(conceptRelations)
      .where(
        and(
          eq(conceptRelations.lifeGraphId, context.lifeGraphId),
          sql`(${conceptRelations.fromConceptId} = ${conceptId} OR ${conceptRelations.toConceptId} = ${conceptId})`,
        ),
      );

    return rows.map(toConceptRelation);
  }

  async saveRelation(
    context: LifeGraphContext,
    relation: ConceptRelation,
  ): Promise<ConceptRelation> {
    if (relation.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleConceptRepository.saveRelation: relation.lifeGraphId (${relation.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }

    const [row] = await this.db
      .insert(conceptRelations)
      .values({
        id: relation.id,
        lifeGraphId: relation.lifeGraphId,
        fromConceptId: relation.fromConceptId,
        toConceptId: relation.toConceptId,
        relationType: relation.relationType,
        strength: relation.strength ?? null,
        createdAt: relation.createdAt,
      })
      .onConflictDoUpdate({
        target: conceptRelations.id,
        set: {
          relationType: relation.relationType,
          strength: relation.strength ?? null,
        },
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleConceptRepository.saveRelation: no se pudo persistir.");
    }

    return toConceptRelation(row);
  }

  async listEvidence(
    context: LifeGraphContext,
    conceptId: EntityId,
  ): Promise<ConceptEvidence[]> {
    const rows = await this.db
      .select()
      .from(conceptEvidence)
      .where(
        and(
          eq(conceptEvidence.lifeGraphId, context.lifeGraphId),
          eq(conceptEvidence.conceptId, conceptId),
        ),
      );

    return rows.map(toConceptEvidence);
  }

  async saveEvidence(
    context: LifeGraphContext,
    evidence: ConceptEvidence,
  ): Promise<ConceptEvidence> {
    if (evidence.lifeGraphId !== context.lifeGraphId) {
      throw new Error(
        `DrizzleConceptRepository.saveEvidence: evidence.lifeGraphId (${evidence.lifeGraphId}) no coincide con context.lifeGraphId (${context.lifeGraphId}).`,
      );
    }

    const [row] = await this.db
      .insert(conceptEvidence)
      .values({
        id: evidence.id,
        lifeGraphId: evidence.lifeGraphId,
        conceptId: evidence.conceptId,
        insightId: evidence.insightId ?? null,
        memoryId: evidence.memoryId,
        createdAt: evidence.createdAt,
      })
      .onConflictDoUpdate({
        target: conceptEvidence.id,
        set: {
          conceptId: evidence.conceptId,
          insightId: evidence.insightId ?? null,
          memoryId: evidence.memoryId,
        },
      })
      .returning();

    if (!row) {
      throw new Error("DrizzleConceptRepository.saveEvidence: no se pudo persistir.");
    }

    return toConceptEvidence(row);
  }
}
