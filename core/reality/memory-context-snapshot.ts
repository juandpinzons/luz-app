import type { EntityId } from "../life/value-objects/entity-id";

/**
 * Proyección mínima de una memoria — deliberadamente no es `Memory`
 * de `core/memory-engine`, por la misma razón que `LifeStateItem` no
 * es `Goal`: `core/reality` no depende de ningún engine concreto. Un
 * futuro ensamblador traduce `Memory` real a esta forma.
 */
export interface RealityMemoryItem {
  id: EntityId;
  content: string;
  occurredAt?: Date;
}

/** Memorias relevantes para interpretar el momento actual, no toda la memoria disponible. */
export interface MemoryContextSnapshot {
  items: RealityMemoryItem[];
}
