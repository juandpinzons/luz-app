export type ReferenceValidationReason = "dangling" | "unknown_type_value";

/**
 * Se lanza cuando una referencia (a punto de escribirse, o ya escrita)
 * no resuelve a una fila real -- `"dangling"` cuando el id no existe en
 * la tabla destino conocida; `"unknown_type_value"` cuando el valor de
 * "type" ni siquiera está registrado (`../registry`) -- probable typo
 * o vocabulario nuevo sin declarar, nunca se deja pasar en silencio.
 */
export class ReferenceValidationError extends Error {
  constructor(
    readonly referencePointName: string,
    readonly reason: ReferenceValidationReason,
    readonly typeValue: string | null,
    readonly danglingId: string,
    readonly targetTableName: string | null,
  ) {
    super(
      reason === "unknown_type_value"
        ? `ReferenceValidationError: "${referencePointName}" recibió un typeValue no registrado ("${typeValue}") para id ${danglingId}.`
        : `ReferenceValidationError: "${referencePointName}" apunta a un id que no existe (${danglingId} en "${targetTableName}"${typeValue ? `, type="${typeValue}"` : ""}).`,
    );
    this.name = "ReferenceValidationError";
  }
}
