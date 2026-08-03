import { inArray } from "drizzle-orm";
import type { Database } from "../../db/client";
import type { ReferencePoint } from "../domain";
import { REFERENCE_POINTS } from "../registry";
import type { RepairPlan } from "./repair-plan";

export interface RepairJobResult {
  readonly plan: RepairPlan;
  readonly executed: boolean;
  readonly deletedRows: number;
  readonly nullifiedRows: number;
}

/**
 * Ejecuta un `RepairPlan` de verdad -- la única función de todo este
 * módulo que muta datos. Por diseño:
 *
 * - **`{ confirm: true }` obligatorio y explícito.** Sin él, lanza
 *   antes de tocar la base de datos -- nunca un default silencioso
 *   hacia "sí, ejecuta".
 * - **Una sola transacción.** Si algo falla a mitad de camino, nada
 *   queda a medio reparar.
 * - **Por lote, agrupado por punto** (`inArray` sobre `ownId`) para los
 *   borrados -- mismo criterio contra N+1 que el resto de este módulo.
 *   Los `nullify` (Grupo C, 3 columnas nullable) corren uno por fila
 *   porque son funciones escritas a mano por columna, no genéricas --
 *   volumen esperado bajo (huérfanos nunca deberían ser la mayoría de
 *   una tabla sana).
 *
 * Esta función se construyó y se probó contra Postgres local
 * (docker) en esta sesión -- nunca se corrió con `confirm: true`
 * contra ninguna base de datos de producción ni de desarrollo
 * compartido.
 */
export async function executeRepairPlan(
  db: Database,
  plan: RepairPlan,
  options: { readonly confirm: true },
  points: readonly ReferencePoint[] = REFERENCE_POINTS,
): Promise<RepairJobResult> {
  if (!options.confirm) {
    throw new Error(
      "executeRepairPlan: se requiere { confirm: true } explícito -- por defecto esta función nunca muta datos.",
    );
  }

  const byName = new Map(points.map((point) => [point.name, point]));
  let deletedRows = 0;
  let nullifiedRows = 0;

  await db.transaction(async (tx) => {
    const deleteGroups = new Map<string, string[]>();
    for (const action of plan.actions) {
      if (action.strategy !== "delete_row") continue;
      const ids = deleteGroups.get(action.referencePointName) ?? [];
      ids.push(action.ownId);
      deleteGroups.set(action.referencePointName, ids);
    }

    for (const [pointName, ownIds] of deleteGroups) {
      const point = byName.get(pointName);
      if (!point) continue;
      await tx.delete(point.table).where(inArray(point.ownIdColumn, ownIds));
      deletedRows += ownIds.length;
    }

    for (const action of plan.actions) {
      if (action.strategy !== "null_reference") continue;
      const point = byName.get(action.referencePointName);
      if (point?.kind !== "bare" || !point.nullify) continue;
      await point.nullify(tx, action.ownId);
      nullifiedRows += 1;
    }
  });

  return { plan, executed: true, deletedRows, nullifiedRows };
}
