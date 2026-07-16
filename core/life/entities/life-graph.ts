import type { EntityId } from "../value-objects/entity-id";

/**
 * Aggregate root y única frontera de tenencia del dominio (ADR-0011).
 * Toda consulta que hoy significa "los datos de este usuario" significa
 * en realidad "los datos de este LifeGraph". Posee a `Person`, `Goal`,
 * `Project`, `Habit`, `Routine`, `Relationship`, `LifeEvent` y
 * `LifeDomain` — Memory, Knowledge y Context operan sobre un LifeGraph
 * vía `lifeGraphId`, pero no son miembros de este agregado (ver
 * ENGINE_MANIFESTO.md: ningún engine es dueño de otro).
 *
 * `ownerPersonId` es el único miembro con privilegios de owner; el
 * resto de miembros son `Person` comunes sin ningún campo que las
 * distinga como "raíz".
 */
export interface LifeGraph {
  id: EntityId;
  ownerPersonId: EntityId;
  createdAt: Date;
  updatedAt: Date;
}
