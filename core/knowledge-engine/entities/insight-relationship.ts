import type { EntityId } from "../../life/value-objects/entity-id";

/**
 * Arista entre dos insights ya persistidos — el conocimiento conectado
 * a otro conocimiento (KNOWLEDGE_MODEL.md: "represented as connected
 * entities rather than isolated records"). Distinta de `Evidence`
 * (Insight → Memory, la base) y de `RelatedItem.relatedMemories`
 * (memorias candidatas durante el pipeline, previas a persistir nada).
 */
export interface InsightRelationship {
  id: EntityId;
  lifeGraphId: EntityId;
  fromInsightId: EntityId;
  toInsightId: EntityId;
  /** Texto libre a propósito, igual que `LifeEdge.relationType`. */
  relationType: string;
  /** Fuerza de la conexión, 0-100. */
  strength?: number;
  createdAt: Date;
}
