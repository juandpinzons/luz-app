import type { EntityId } from "../value-objects/entity-id";
import type { LifeNode } from "./life-node";

/**
 * Arista entre dos `LifeNode`. `relationType` es texto libre (no un enum
 * cerrado) a propósito, igual que `entity_relations.relation_type` en
 * `core/db/schema/relations.ts` — el vocabulario de relaciones entre
 * nodos del grafo crece con el dominio y no debe forzarse a la lista
 * cerrada de `RelationshipType`, que es específica de vínculos con
 * personas.
 */
export interface LifeEdge {
  id: EntityId;
  from: LifeNode;
  to: LifeNode;
  relationType: string;
  metadata?: Record<string, unknown>;
}
