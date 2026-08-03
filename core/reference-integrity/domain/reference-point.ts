import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";
import type { Database, Transaction } from "../../db/client";
import type { ReferenceTarget } from "./reference-target";

/**
 * Un LUGAR concreto del esquema donde vive una referencia polimórfica
 * o "sin FK por diseño" -- una fila del inventario de la auditoría
 * (ver `../registry/reference-registry.ts`). Unión discriminada por
 * `kind`:
 *
 * - `"polymorphic"`: par de columnas type+id (`entityType`/`entityId`,
 *   `sourceType`/`sourceId`, `refType`/`refId`, `fromType`/`fromId`...)
 *   -- el destino real depende del VALOR de `typeColumn` en cada fila,
 *   por eso `targets` es una lista.
 * - `"bare"`: una sola columna id, sin columna de tipo, con un ÚNICO
 *   destino fijo (p. ej. `beliefs.subjectPersonId` -> `persons`,
 *   siempre) -- mismo problema de fondo ("sin FK real"), forma más
 *   simple.
 *
 * `ownIdColumn` es el id PROPIO de la fila que contiene la referencia
 * (su propia PK) -- necesario para reparar (borrar la fila, o poner en
 * null la referencia) sin depender de reconstruir dinámicamente el
 * nombre de columna.
 */
interface ReferencePointBase {
  /** Identificador legible y único de este punto, p. ej. `"entity_relations.from"` -- usado en reportes y como clave de búsqueda. */
  readonly name: string;
  readonly table: AnyPgTable;
  readonly tableName: string;
  readonly ownIdColumn: AnyPgColumn;
  readonly nullable: boolean;
  /** Documentación corta de qué representa esta referencia -- para reportes, no para lógica. */
  readonly description: string;
}

export interface PolymorphicReferencePoint extends ReferencePointBase {
  readonly kind: "polymorphic";
  readonly typeColumn: AnyPgColumn;
  readonly idColumn: AnyPgColumn;
  readonly targets: readonly ReferenceTarget[];
}

export interface BareReferencePoint extends ReferencePointBase {
  readonly kind: "bare";
  readonly idColumn: AnyPgColumn;
  readonly target: ReferenceTarget;
  /**
   * Solo presente cuando `nullable` es `true` -- función de reparación
   * escrita a mano (tipada, sin SQL dinámico) que pone la columna en
   * `NULL` para una fila dada. No existe para columnas `notNull`: ahí
   * la única reparación posible sin cambiar el esquema es borrar la
   * fila completa (ver `../repair`).
   */
  readonly nullify?: (db: Database | Transaction, ownId: string) => Promise<void>;
}

export type ReferencePoint = PolymorphicReferencePoint | BareReferencePoint;
