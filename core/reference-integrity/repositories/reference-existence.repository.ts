import { inArray } from "drizzle-orm";
import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";
import type { Database } from "../../db/client";

/**
 * El único primitivo real de este módulo: "de este lote de ids, ¿cuáles
 * existen de verdad en esta tabla?". Todo lo demás (validator,
 * integrity checker, orphan detector) se construye sobre esto.
 *
 * Por lote (`inArray`), NUNCA una consulta por id -- auditoría de
 * rendimiento previa ("Graph Performance", Fase I) encontró y corrigió
 * exactamente este patrón en otras partes del código; esta
 * infraestructura nueva no debe reintroducirlo. Un `ids` vacío no
 * dispara ninguna consulta.
 *
 * **Límite documentado a propósito**: esto verifica EXISTENCIA, no
 * TENENCIA -- un id real que pertenece a un LifeGraph/usuario distinto
 * del esperado se reporta como "existe". Cruzar tenencia es una
 * verificación más fuerte, no implementada aquí (ver README del
 * módulo, "Qué NO hace esta infraestructura").
 */
export async function checkIdsExist(
  db: Database,
  table: AnyPgTable,
  idColumn: AnyPgColumn,
  ids: readonly string[],
): Promise<ReadonlySet<string>> {
  if (ids.length === 0) {
    return new Set();
  }

  const uniqueIds = [...new Set(ids)];
  const rows = await db
    .select({ id: idColumn })
    .from(table)
    .where(inArray(idColumn, uniqueIds));

  return new Set(rows.map((row) => String(row.id)));
}

/** Conveniencia para un solo id -- construida sobre `checkIdsExist`, nunca una consulta separada. */
export async function checkIdExists(
  db: Database,
  table: AnyPgTable,
  idColumn: AnyPgColumn,
  id: string,
): Promise<boolean> {
  const found = await checkIdsExist(db, table, idColumn, [id]);
  return found.has(id);
}
