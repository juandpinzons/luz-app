import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { wearableDailyMetrics, type WearableDailyMetricsRow } from "../db/schema/wearable";
import type { EntityId } from "../life/value-objects/entity-id";
import type { DailyWearableMetrics } from "../../features/reality/domain/wearable-daily-metrics";
import type { WearableProviderKind } from "../../features/reality/domain/wearable-provider-kind";

/**
 * Capa de persistencia real de `DailyWearableMetrics`
 * (`features/reality/domain/`) -- Wearable Foundation, a diferencia de
 * Calendar/Gmail Foundation, sí persiste desde su primera fase (ver
 * docblock de `core/db/schema/wearable.ts`).
 */

function toDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function toDomain(row: WearableDailyMetricsRow): DailyWearableMetrics {
  const hasSleep =
    row.sleepTotalMinutes !== null ||
    row.sleepDeepMinutes !== null ||
    row.sleepLightMinutes !== null ||
    row.sleepRemMinutes !== null ||
    row.sleepAwakeMinutes !== null ||
    row.sleepQualityScore !== null;

  const hasStages =
    row.sleepDeepMinutes !== null ||
    row.sleepLightMinutes !== null ||
    row.sleepRemMinutes !== null ||
    row.sleepAwakeMinutes !== null;

  return {
    date: row.date.toISOString().slice(0, 10),
    steps: row.steps ?? undefined,
    restingHeartRateBpm: row.restingHeartRateBpm ?? undefined,
    averageStressLevel: row.averageStressLevel ?? undefined,
    sleep:
      hasSleep && row.sleepTotalMinutes !== null
        ? {
            totalMinutes: row.sleepTotalMinutes,
            qualityScore: row.sleepQualityScore ?? undefined,
            stages: hasStages
              ? {
                  deepMinutes: row.sleepDeepMinutes ?? 0,
                  lightMinutes: row.sleepLightMinutes ?? 0,
                  remMinutes: row.sleepRemMinutes ?? 0,
                  awakeMinutes: row.sleepAwakeMinutes ?? 0,
                }
              : undefined,
          }
        : undefined,
  };
}

/**
 * Upsert por (`lifeGraphId`, `provider`, `date`) -- reimportar el
 * mismo día actualiza la fila, nunca acumula duplicados (ver índice
 * único en el schema). Secuencial, no en batch: el volumen esperado
 * (como mucho unos cientos de días por import) hace que la simplicidad
 * gane sobre una sola sentencia `INSERT ... VALUES (...), (...)` --
 * ver `MEMORY_ENGINE_MIGRATION_PLAN.md` para el mismo criterio ya
 * aplicado en otro import por lotes.
 */
export async function upsertDailyMetrics(
  db: Database,
  lifeGraphId: EntityId,
  provider: WearableProviderKind,
  entries: readonly DailyWearableMetrics[],
): Promise<number> {
  let count = 0;
  for (const entry of entries) {
    const now = new Date();
    await db
      .insert(wearableDailyMetrics)
      .values({
        lifeGraphId,
        provider,
        date: toDate(entry.date),
        steps: entry.steps ?? null,
        restingHeartRateBpm: entry.restingHeartRateBpm ?? null,
        averageStressLevel: entry.averageStressLevel ?? null,
        sleepTotalMinutes: entry.sleep?.totalMinutes ?? null,
        sleepDeepMinutes: entry.sleep?.stages?.deepMinutes ?? null,
        sleepLightMinutes: entry.sleep?.stages?.lightMinutes ?? null,
        sleepRemMinutes: entry.sleep?.stages?.remMinutes ?? null,
        sleepAwakeMinutes: entry.sleep?.stages?.awakeMinutes ?? null,
        sleepQualityScore: entry.sleep?.qualityScore ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [wearableDailyMetrics.lifeGraphId, wearableDailyMetrics.provider, wearableDailyMetrics.date],
        set: {
          steps: entry.steps ?? null,
          restingHeartRateBpm: entry.restingHeartRateBpm ?? null,
          averageStressLevel: entry.averageStressLevel ?? null,
          sleepTotalMinutes: entry.sleep?.totalMinutes ?? null,
          sleepDeepMinutes: entry.sleep?.stages?.deepMinutes ?? null,
          sleepLightMinutes: entry.sleep?.stages?.lightMinutes ?? null,
          sleepRemMinutes: entry.sleep?.stages?.remMinutes ?? null,
          sleepAwakeMinutes: entry.sleep?.stages?.awakeMinutes ?? null,
          sleepQualityScore: entry.sleep?.qualityScore ?? null,
          updatedAt: now,
        },
      });
    count += 1;
  }
  return count;
}

/** Más reciente primero -- mismo orden que `getRecentMemoryHighlight`/`listRecentActiveMemories`. Sin límite explícito: el volumen esperado (días, no mensajes) nunca acerca al techo que sí hace falta en otras tablas de mayor cardinalidad. */
export async function listDailyMetrics(
  db: Database,
  lifeGraphId: EntityId,
  provider: WearableProviderKind,
): Promise<DailyWearableMetrics[]> {
  const rows = await db
    .select()
    .from(wearableDailyMetrics)
    .where(and(eq(wearableDailyMetrics.lifeGraphId, lifeGraphId), eq(wearableDailyMetrics.provider, provider)))
    .orderBy(desc(wearableDailyMetrics.date));

  return rows.map(toDomain);
}
