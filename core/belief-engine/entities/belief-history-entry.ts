import type { EntityId } from "../../life/value-objects/entity-id";

/**
 * Fila append-only de la evolución de un Belief. `previousConfidence`
 * indefinido únicamente en la fila de creación. Ver `belief-trend.ts`
 * para cómo se deriva "se está fortaleciendo/debilitando" a partir de
 * una secuencia de estas filas -- nunca cacheado aquí.
 */
export interface BeliefHistoryEntry {
  id: EntityId;
  lifeGraphId: EntityId;
  beliefId: EntityId;
  previousConfidence?: number;
  newConfidence: number;
  changeReason: string;
  changedAt: Date;
}
