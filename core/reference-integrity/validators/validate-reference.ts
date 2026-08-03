import type { Database } from "../../db/client";
import type { BareReferencePoint, PolymorphicReferencePoint } from "../domain";
import { checkIdExists } from "../repositories/reference-existence.repository";
import { ReferenceValidationError } from "./reference-validation-error";

/**
 * Guarda de escritura para un `BareReferencePoint` -- confirma que
 * `id` existe de verdad en el destino fijo del punto ANTES de dejar
 * que el llamador persista una fila que lo referencia. Lanza
 * `ReferenceValidationError` si no existe; no devuelve `boolean` a
 * propósito -- una referencia inválida es un error del llamador, no
 * un resultado a ignorar en silencio (mismo criterio que el resto del
 * dominio: nunca dejar pasar un dato inconsistente sin que alguien lo
 * note).
 *
 * Si el destino está marcado `unsupported` (ver `../domain/reference-target.ts`),
 * no bloquea -- este módulo no puede verificar ese caso, y bloquear una
 * escritura legítima por una limitación propia sería peor que no
 * verificar.
 */
export async function validateBareReference(
  db: Database,
  point: BareReferencePoint,
  id: string,
): Promise<void> {
  if (point.target.unsupported) {
    return;
  }

  const exists = await checkIdExists(db, point.target.table, point.target.idColumn, id);
  if (!exists) {
    throw new ReferenceValidationError(point.name, "dangling", null, id, point.target.tableName);
  }
}

/**
 * Guarda de escritura para un `PolymorphicReferencePoint` -- primero
 * confirma que `typeValue` está registrado (`point.targets`), después
 * que `id` existe en la tabla que ese `typeValue` selecciona.
 */
export async function validatePolymorphicReference(
  db: Database,
  point: PolymorphicReferencePoint,
  typeValue: string,
  id: string,
): Promise<void> {
  const target = point.targets.find((candidate) => candidate.typeValue === typeValue);
  if (!target) {
    throw new ReferenceValidationError(point.name, "unknown_type_value", typeValue, id, null);
  }

  if (target.unsupported) {
    return;
  }

  const exists = await checkIdExists(db, target.table, target.idColumn, id);
  if (!exists) {
    throw new ReferenceValidationError(point.name, "dangling", typeValue, id, target.tableName);
  }
}
