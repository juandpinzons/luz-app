import type { EntityId } from "../value-objects/entity-id";

/**
 * Tipos de entidad de `core/life` que pueden participar como nodo del
 * Life Graph. Deliberadamente distinto de `EntityType`
 * (`core/db/schema/entity-type.ts`): ese es el vocabulario del Knowledge
 * Graph persistido en Postgres; este es el del dominio, agnóstico de
 * infraestructura.
 */
export const LIFE_NODE_TYPES = [
  "person",
  "goal",
  "project",
  "habit",
  "routine",
  "life_event",
  "life_domain",
] as const;

export type LifeNodeType = (typeof LIFE_NODE_TYPES)[number];

export interface LifeNode {
  id: EntityId;
  type: LifeNodeType;
}
