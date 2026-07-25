import type { EntityId } from "../life/value-objects/entity-id";

/**
 * Proyección mínima de un Insight -- deliberadamente no es `Insight`
 * de `core/knowledge-engine`, misma razón que `RealityMemoryItem` no
 * es `Memory` (`memory-context-snapshot.ts`): `core/reality` es kernel
 * compartido, no importa el tipo de ningún engine concreto. Un futuro
 * ensamblador traduce `Insight` real a esta forma -- la frontera
 * anti-corrupción, nunca cruzada dentro de este módulo.
 */
export interface RealityInsightItem {
  id: EntityId;
  description: string;
  type: string;
}

/**
 * Insights ya validados relevantes para el momento actual, no todo el
 * conocimiento acumulado -- mismo criterio que `MemoryContextSnapshot`:
 * la ausencia real se representa como ausencia (`items: []`), nunca se
 * rellena con algo de menor confianza para no dejarlo vacío.
 */
export interface InsightContextSnapshot {
  items: RealityInsightItem[];
}
