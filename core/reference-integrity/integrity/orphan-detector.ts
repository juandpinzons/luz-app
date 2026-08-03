import type { Database } from "../../db/client";
import type { OrphanRecord } from "../domain";
import { REFERENCE_POINTS } from "../registry";
import { scanReferencePoint } from "./scan-reference-point";

/**
 * Lista plana de huérfanos de UN punto, por nombre (ver
 * `ReferencePoint.name` en `../registry`) -- para cuando ya se sabe
 * cuál punto interesa, sin pagar el costo de escanear los demás.
 */
export async function findOrphansForPoint(
  db: Database,
  referencePointName: string,
): Promise<readonly OrphanRecord[]> {
  const point = REFERENCE_POINTS.find((candidate) => candidate.name === referencePointName);
  if (!point) {
    throw new Error(
      `findOrphansForPoint: no existe un ReferencePoint llamado "${referencePointName}" -- ver ../registry/reference-registry.ts para los nombres válidos.`,
    );
  }

  const result = await scanReferencePoint(db, point);
  return result.orphans;
}

/**
 * Lista plana de TODOS los huérfanos, en todos los puntos registrados
 * -- azúcar sobre `runIntegrityCheck` para el caso de uso más común
 * ("dame los huérfanos", sin el desglose completo por punto).
 */
export async function findAllOrphans(db: Database): Promise<readonly OrphanRecord[]> {
  const reports = await Promise.all(REFERENCE_POINTS.map((point) => scanReferencePoint(db, point)));
  return reports.flatMap((report) => report.orphans);
}
