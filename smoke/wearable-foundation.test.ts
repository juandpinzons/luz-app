import { eq } from "drizzle-orm";
import { db } from "../core/db/client";
import { wearableDailyMetrics } from "../core/db/schema";
import { listDailyMetrics } from "../core/wearable-metrics/repository";
import { GarminProvider } from "../features/reality/providers/garmin";
import { importWearableExport } from "../features/reality/application/import-wearable-export";
import { getWearableSnapshot } from "../features/reality/application/get-wearable-snapshot";
import { buildWearableSignals } from "../features/chat/services/wearable-signals";
import { getWearableSignalsForConversation } from "../features/chat/services/get-wearable-signals-for-conversation";
import type { SmokeContext, SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Fixture con dos formas de nombre de campo reales de Garmin (ver
 * docblock de `garmin-provider.ts`): el día más reciente usa
 * camelCase (forma del endpoint `wellness-service` que el propio sitio
 * de Garmin Connect usa), un día más viejo usa PascalCase (forma del
 * export masivo de cuenta, estilo Health API) -- prueba real de que
 * `firstDefined` cubre ambas, no solo la que se probó primero.
 */
const FIXTURE_EXPORT = JSON.stringify([
  {
    // Día más reciente -- sueño corto (5h) + estrés alto, para probar ambas alertas.
    calendarDate: "2026-08-13",
    steps: 4200,
    restingHeartRate: 58,
    averageStressLevel: 63,
    sleepTimeSeconds: 320 * 60,
    deepSleepSeconds: 40 * 60,
    lightSleepSeconds: 220 * 60,
    remSleepSeconds: 50 * 60,
    awakeSeconds: 10 * 60,
    sleepScore: 52,
  },
  {
    calendarDate: "2026-08-12",
    steps: 9100,
    restingHeartRate: 55,
    averageStressLevel: 28,
    sleepTimeSeconds: 430 * 60,
  },
  {
    // Día más viejo, forma PascalCase (export masivo de cuenta).
    CalendarDate: "2026-08-11",
    Steps: 8800,
    RestingHeartRateInBeatsPerMinute: 56,
    DurationInSeconds: 420 * 60,
    DeepSleepDurationInSeconds: 70 * 60,
    LightSleepDurationInSeconds: 260 * 60,
    RemSleepInSeconds: 70 * 60,
    AwakeDurationInSeconds: 20 * 60,
    OverallSleepScore: { Value: 78 },
  },
]);

export const wearableFoundationFlow: SmokeFlow = {
  name: "wearable-foundation",
  async run(ctx: SmokeContext) {
    const lifeGraphId = ctx.lifeGraphContext.lifeGraphId;
    await db.delete(wearableDailyMetrics).where(eq(wearableDailyMetrics.lifeGraphId, lifeGraphId));

    try {
      // 1. Parseo puro -- ambas formas de nombre de campo.
      const provider = new GarminProvider();
      const parsed = provider.parseExport(FIXTURE_EXPORT);
      assert(parsed.dailyMetrics.length === 3, `esperaba 3 días parseados, obtuvo ${parsed.dailyMetrics.length}`);
      const oldest = parsed.dailyMetrics.find((d) => d.date === "2026-08-11");
      assert(oldest !== undefined, "no se encontró el día en forma PascalCase (2026-08-11)");
      assert(
        oldest.sleep?.totalMinutes === 420,
        `día PascalCase: esperaba 420 min de sueño, obtuvo ${oldest.sleep?.totalMinutes}`,
      );
      assert(
        oldest.sleep?.qualityScore === 78,
        `día PascalCase: esperaba sleepQualityScore 78 (anidado en OverallSleepScore.Value), obtuvo ${oldest.sleep?.qualityScore}`,
      );

      // 2. Persistencia real (upsert) contra Postgres real.
      const result = await importWearableExport(db, ctx.lifeGraphContext, provider, FIXTURE_EXPORT);
      assert(result.daysImported === 3, `esperaba 3 días importados, obtuvo ${result.daysImported}`);

      // Reimportar el mismo archivo no debe duplicar filas (upsert por fecha).
      const resultAgain = await importWearableExport(db, ctx.lifeGraphContext, provider, FIXTURE_EXPORT);
      assert(
        resultAgain.daysImported === 3,
        `reimport: esperaba seguir reportando 3 días, obtuvo ${resultAgain.daysImported}`,
      );
      const rowsAfterReimport = await listDailyMetrics(db, lifeGraphId, "garmin");
      assert(
        rowsAfterReimport.length === 3,
        `reimport no debía duplicar filas -- esperaba 3, hay ${rowsAfterReimport.length}`,
      );

      // 3. Lectura + snapshot -- el día más reciente primero.
      const dailyMetrics = await listDailyMetrics(db, lifeGraphId, "garmin");
      assert(
        dailyMetrics[0]?.date === "2026-08-13",
        `esperaba 2026-08-13 como el día más reciente, obtuvo ${dailyMetrics[0]?.date}`,
      );

      const snapshot = getWearableSnapshot(dailyMetrics);
      assert(snapshot.hasData, "snapshot.hasData debería ser true con 3 días persistidos");
      assert(snapshot.lowSleepAlert, "5h de sueño debería activar lowSleepAlert");
      assert(snapshot.elevatedStressAlert, "estrés 63 debería activar elevatedStressAlert");
      assert(
        snapshot.trend?.averageSteps === Math.round((4200 + 9100 + 8800) / 3),
        `trend.averageSteps mal calculado: ${snapshot.trend?.averageSteps}`,
      );

      // 4. Traducción a señal de chat, pura + a través del wrapper real de I/O.
      const signals = buildWearableSignals(snapshot);
      assert(
        signals.some((s) => s.content.includes("5h") && s.content.includes("20min")),
        "esperaba una señal mencionando '5h 20min' de sueño",
      );
      assert(
        signals.some((s) => s.content.includes("63/100")),
        "esperaba una señal mencionando el estrés '63/100'",
      );

      const signalsViaWrapper = await getWearableSignalsForConversation(db, ctx.lifeGraphContext);
      assert(
        signalsViaWrapper.length === signals.length,
        "getWearableSignalsForConversation debería producir las mismas señales que buildWearableSignals",
      );
    } finally {
      await db.delete(wearableDailyMetrics).where(eq(wearableDailyMetrics.lifeGraphId, lifeGraphId));
    }
  },
};
