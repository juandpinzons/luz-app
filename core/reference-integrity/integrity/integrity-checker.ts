import type { Database } from "../../db/client";
import type { IntegrityReport, ReferencePoint } from "../domain";
import { REFERENCE_POINTS } from "../registry";
import { scanReferencePoint } from "./scan-reference-point";

/**
 * Corre `scanReferencePoint` sobre TODOS los puntos registrados (o el
 * subconjunto que se pase) y arma el reporte consolidado. Cada punto
 * es independiente -- se corren en paralelo, un punto lento o con
 * errores no bloquea a los demás.
 */
export async function runIntegrityCheck(
  db: Database,
  points: readonly ReferencePoint[] = REFERENCE_POINTS,
): Promise<IntegrityReport> {
  const results = await Promise.all(points.map((point) => scanReferencePoint(db, point)));

  return {
    generatedAt: new Date(),
    points: results,
    totalOrphans: results.reduce((sum, result) => sum + result.orphans.length, 0),
    totalUnsupported: results.reduce((sum, result) => sum + result.unsupportedRows, 0),
  };
}
