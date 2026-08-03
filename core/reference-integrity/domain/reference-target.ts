import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";

/**
 * Un destino posible para un valor de "type" dentro de una referencia
 * polimórfica -- p. ej., para `entity_relations.fromType = "insight"`,
 * el destino es la tabla `insights` (legada) y su columna `id`.
 *
 * `scopeColumn` es OPCIONAL y documenta, cuando se conoce, con qué
 * columna de tenencia (`lifeGraphId`/`userId`) está escopada esta
 * tabla destino -- existe para dejar explícito un límite real de este
 * módulo (ver README): el chequeo de existencia base NUNCA verifica
 * que el id encontrado pertenezca al MISMO tenant que la fila que lo
 * referencia, solo que el id existe en algún lugar de la tabla. Un id
 * real pero de OTRO LifeGraph/usuario pasaría el chequeo básico -- eso
 * es "cruce de tenencia", una clase de bug distinta de "huérfano",
 * documentada pero no resuelta por esta infraestructura todavía.
 */
export interface ReferenceTarget {
  /** El valor de "type" que selecciona este destino (p. ej. "insight", "belief") -- o `null` para una referencia sin columna de tipo (ver `ReferencePoint` "bare"). */
  readonly typeValue: string | null;
  readonly table: AnyPgTable;
  /** Nombre de tabla real en Postgres -- para reportes legibles, no para construir SQL (eso usa `table`/`idColumn` directamente). */
  readonly tableName: string;
  readonly idColumn: AnyPgColumn;
  readonly scopeColumn?: AnyPgColumn;
  /**
   * `true` cuando este destino es estructuralmente imposible de
   * verificar con un chequeo directo por id (p. ej. `entity_relations`
   * es legado y escopado por `userId`, pero `"memory"` apuntaría a
   * `memories`, que es escopada por `lifeGraphId` -- no hay una
   * columna de usuario en `memories` para cruzar). El integrity
   * checker reporta estos casos como "no verificable", nunca como
   * huérfano ni como válido -- una tercera categoría honesta.
   */
  readonly unsupported?: { readonly reason: string };
}
