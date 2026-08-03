/**
 * `"delete_row"`: la única reparación posible para una referencia
 * `notNull` (10 de los 13 puntos, ver `../registry`) sin cambiar el
 * esquema -- la fila entera pierde su sentido si la referencia que la
 * define no existe. `"null_reference"`: para las 3 columnas `nullable`
 * (`belief_evidence.insightId`/`memoryId`, `concept_evidence.insightId`)
 * que sí tienen una función `nullify` registrada -- se conserva la
 * fila, solo se limpia el puntero roto.
 */
export type RepairStrategy = "delete_row" | "null_reference";

export interface RepairAction {
  readonly referencePointName: string;
  /** El id PROPIO de la fila afectada (su PK) -- nunca el id colgante. */
  readonly ownId: string;
  readonly strategy: RepairStrategy;
  readonly reason: string;
}

export interface RepairPlan {
  readonly generatedAt: Date;
  readonly actions: readonly RepairAction[];
}
