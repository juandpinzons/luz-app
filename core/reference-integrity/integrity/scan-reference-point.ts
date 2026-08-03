import type { Database } from "../../db/client";
import type { BareReferencePoint, OrphanRecord, PolymorphicReferencePoint, ReferencePoint, ReferencePointReport } from "../domain";
import { checkIdsExist } from "../repositories/reference-existence.repository";

async function scanBarePoint(db: Database, point: BareReferencePoint): Promise<ReferencePointReport> {
  const rows = await db.select({ ownId: point.ownIdColumn, refId: point.idColumn }).from(point.table);
  const totalRows = rows.length;

  if (point.target.unsupported) {
    return {
      referencePointName: point.name,
      totalRows,
      checkedRows: 0,
      healthyRows: 0,
      orphans: [],
      unsupportedRows: totalRows,
      unsupportedReasons: totalRows > 0 ? [point.target.unsupported.reason] : [],
    };
  }

  // `refId` es `null` para una fila que legítimamente no tiene esta
  // referencia (columnas nullable, Grupo C) -- nunca un huérfano, se
  // excluye del conteo de "checked" igual que de "orphans".
  const referenced = rows.filter(
    (row): row is { ownId: unknown; refId: string } => row.refId !== null,
  );
  const referencedIds = referenced.map((row) => String(row.refId));
  const existing = await checkIdsExist(db, point.target.table, point.target.idColumn, referencedIds);

  const orphans: OrphanRecord[] = referenced
    .filter((row) => !existing.has(String(row.refId)))
    .map((row) => ({
      referencePointName: point.name,
      ownId: String(row.ownId),
      typeValue: null,
      danglingId: String(row.refId),
      targetTableName: point.target.tableName,
    }));

  return {
    referencePointName: point.name,
    totalRows,
    checkedRows: referenced.length,
    healthyRows: referenced.length - orphans.length,
    orphans,
    unsupportedRows: 0,
    unsupportedReasons: [],
  };
}

async function scanPolymorphicPoint(db: Database, point: PolymorphicReferencePoint): Promise<ReferencePointReport> {
  const rows = await db
    .select({ ownId: point.ownIdColumn, typeValue: point.typeColumn, refId: point.idColumn })
    .from(point.table);
  const totalRows = rows.length;

  const byType = new Map<string, { ownId: string; refId: string }[]>();
  for (const row of rows) {
    const typeValue = String(row.typeValue);
    const group = byType.get(typeValue) ?? [];
    group.push({ ownId: String(row.ownId), refId: String(row.refId) });
    byType.set(typeValue, group);
  }

  const orphans: OrphanRecord[] = [];
  const unsupportedReasons: string[] = [];
  let checkedRows = 0;
  let unsupportedRows = 0;

  // Una consulta por VALOR DE TIPO DISTINTO presente en los datos
  // (acotado -- casi siempre < 10), nunca una por fila.
  for (const [typeValue, group] of byType) {
    const target = point.targets.find((candidate) => candidate.typeValue === typeValue);

    if (!target) {
      unsupportedRows += group.length;
      unsupportedReasons.push(`typeValue "${typeValue}" no registrado en este punto (${group.length} fila(s)).`);
      continue;
    }
    if (target.unsupported) {
      unsupportedRows += group.length;
      unsupportedReasons.push(`typeValue "${typeValue}": ${target.unsupported.reason} (${group.length} fila(s)).`);
      continue;
    }

    checkedRows += group.length;
    const existing = await checkIdsExist(
      db,
      target.table,
      target.idColumn,
      group.map((row) => row.refId),
    );

    for (const row of group) {
      if (!existing.has(row.refId)) {
        orphans.push({
          referencePointName: point.name,
          ownId: row.ownId,
          typeValue,
          danglingId: row.refId,
          targetTableName: target.tableName,
        });
      }
    }
  }

  return {
    referencePointName: point.name,
    totalRows,
    checkedRows,
    healthyRows: checkedRows - orphans.length,
    orphans,
    unsupportedRows,
    unsupportedReasons,
  };
}

/** Escanea UN `ReferencePoint` completo -- toda la tabla, agrupado por valor de tipo cuando aplica. Base de `integrity-checker.ts`/`orphan-detector.ts`. */
export async function scanReferencePoint(db: Database, point: ReferencePoint): Promise<ReferencePointReport> {
  return point.kind === "bare" ? scanBarePoint(db, point) : scanPolymorphicPoint(db, point);
}
