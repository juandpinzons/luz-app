import type { OrphanRecord, ReferencePoint } from "../domain";
import { REFERENCE_POINTS } from "../registry";
import type { RepairAction, RepairPlan } from "./repair-plan";

/**
 * Decide QUÉ se haría con cada huérfano -- pura, sin I/O, nunca muta
 * nada. La estrategia no es una elección libre: la determina la
 * propia forma del `ReferencePoint` (¿es `nullable` y tiene
 * `nullify` registrado?), nunca una preferencia externa -- así un
 * plan generado hoy y uno generado en un mes con el mismo huérfano
 * proponen la misma reparación.
 */
export function buildRepairPlan(
  orphans: readonly OrphanRecord[],
  points: readonly ReferencePoint[] = REFERENCE_POINTS,
): RepairPlan {
  const byName = new Map(points.map((point) => [point.name, point]));

  const actions: RepairAction[] = orphans.map((orphan) => {
    const point = byName.get(orphan.referencePointName);
    const canNullify = point?.kind === "bare" && point.nullable && typeof point.nullify === "function";

    return {
      referencePointName: orphan.referencePointName,
      ownId: orphan.ownId,
      strategy: canNullify ? "null_reference" : "delete_row",
      reason: `${orphan.typeValue ? `type="${orphan.typeValue}" ` : ""}id=${orphan.danglingId} no existe en "${orphan.targetTableName}".`,
    };
  });

  return { generatedAt: new Date(), actions };
}
