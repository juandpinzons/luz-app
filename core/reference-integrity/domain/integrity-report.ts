/**
 * Una fila real, encontrada en la base de datos, cuya referencia
 * apunta a un id que NO existe en la tabla destino -- un huérfano
 * confirmado, no una sospecha.
 */
export interface OrphanRecord {
  readonly referencePointName: string;
  /** El id PROPIO de la fila huérfana (su PK) -- lo que hace falta para reparar. */
  readonly ownId: string;
  /** El valor de "type" de esa fila, si el punto es polimórfico -- `null` para un punto "bare". */
  readonly typeValue: string | null;
  /** El id que no se encontró en la tabla destino. */
  readonly danglingId: string;
  readonly targetTableName: string;
}

/**
 * Resultado de escanear UN `ReferencePoint`. `unsupportedRows` cuenta
 * filas cuyo `typeValue` no tiene ningún destino registrado -- no son
 * huérfanos confirmados (podrían ser válidos contra una tabla que este
 * módulo simplemente no sabe verificar todavía), son una tercera
 * categoría honesta ("no verificable"), nunca se cuentan como
 * huérfanos ni como sanos.
 */
export interface ReferencePointReport {
  readonly referencePointName: string;
  readonly totalRows: number;
  readonly checkedRows: number;
  readonly healthyRows: number;
  readonly orphans: readonly OrphanRecord[];
  readonly unsupportedRows: number;
  readonly unsupportedReasons: readonly string[];
}

export interface IntegrityReport {
  readonly generatedAt: Date;
  readonly points: readonly ReferencePointReport[];
  readonly totalOrphans: number;
  readonly totalUnsupported: number;
}
