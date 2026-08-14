import type { DailyWearableMetrics, SleepStageBreakdown } from "../../domain/wearable-daily-metrics";
import type { WearableImportResult } from "../../domain/wearable-import-result";
import type { WearableProvider } from "../wearable-provider";

/**
 * Lectura de un campo que puede venir bajo varios nombres según la
 * fuente real del archivo -- deliberadamente tolerante. Garmin no
 * tiene una única forma de export para una persona individual: el
 * export masivo de cuenta ("Export Your Data") entrega JSON con
 * nombres al estilo de su Health API B2B (`CalendarDate`,
 * `DurationInSeconds`, PascalCase), mientras que el endpoint interno
 * `wellness-service` que el propio sitio de Garmin Connect usa
 * devuelve camelCase (`calendarDate`, `durationInSeconds`) -- ninguno
 * de los dos está documentado públicamente para uso de terceros, así
 * que esta lista de alias es la mejor aproximación disponible sin un
 * archivo real de referencia (2026-08-13). Si el archivo real de la
 * persona usa nombres distintos, este es el ÚNICO lugar que hace
 * falta ajustar -- ninguna otra capa conoce estos nombres.
 */
function firstDefined(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function secondsToMinutes(value: unknown): number | undefined {
  const seconds = asNumber(value);
  return seconds === undefined ? undefined : Math.round(seconds / 60);
}

function readSleepStages(entry: Record<string, unknown>): SleepStageBreakdown | undefined {
  const deepMinutes = secondsToMinutes(
    firstDefined(entry, ["deepSleepSeconds", "DeepSleepDurationInSeconds"]),
  );
  const lightMinutes = secondsToMinutes(
    firstDefined(entry, ["lightSleepSeconds", "LightSleepDurationInSeconds"]),
  );
  const remMinutes = secondsToMinutes(firstDefined(entry, ["remSleepSeconds", "RemSleepInSeconds"]));
  const awakeMinutes = secondsToMinutes(
    firstDefined(entry, ["awakeSeconds", "AwakeDurationInSeconds"]),
  );

  if (
    deepMinutes === undefined &&
    lightMinutes === undefined &&
    remMinutes === undefined &&
    awakeMinutes === undefined
  ) {
    return undefined;
  }

  return {
    deepMinutes: deepMinutes ?? 0,
    lightMinutes: lightMinutes ?? 0,
    remMinutes: remMinutes ?? 0,
    awakeMinutes: awakeMinutes ?? 0,
  };
}

function readSleepQualityScore(entry: Record<string, unknown>): number | undefined {
  const direct = asNumber(firstDefined(entry, ["sleepScore", "SleepScore"]));
  if (direct !== undefined) return direct;

  const nested = firstDefined(entry, ["overallSleepScore", "OverallSleepScore"]);
  if (nested && typeof nested === "object") {
    return asNumber(firstDefined(nested as Record<string, unknown>, ["value", "Value"]));
  }
  return undefined;
}

function toDailyMetrics(entry: Record<string, unknown>): DailyWearableMetrics | null {
  const rawDate = firstDefined(entry, ["calendarDate", "CalendarDate", "date"]);
  if (typeof rawDate !== "string" || rawDate.length === 0) {
    return null;
  }
  const date = rawDate.slice(0, 10);

  const steps = asNumber(firstDefined(entry, ["steps", "totalSteps", "Steps"]));
  const restingHeartRateBpm = asNumber(
    firstDefined(entry, [
      "restingHeartRate",
      "restingHeartRateInBeatsPerMinute",
      "RestingHeartRateInBeatsPerMinute",
    ]),
  );
  const averageStressLevel = asNumber(
    firstDefined(entry, ["averageStressLevel", "avgStressLevel", "stressLevel"]),
  );

  const sleepTotalMinutes = secondsToMinutes(
    firstDefined(entry, ["sleepTimeSeconds", "durationInSeconds", "DurationInSeconds"]),
  );
  const sleep =
    sleepTotalMinutes === undefined
      ? undefined
      : {
          totalMinutes: sleepTotalMinutes,
          stages: readSleepStages(entry),
          qualityScore: readSleepQualityScore(entry),
        };

  return { date, steps, restingHeartRateBpm, averageStressLevel, sleep };
}

/**
 * Único lugar de todo el repo que conoce la forma de un archivo real
 * de Garmin -- mismo principio de aislamiento que `AppleCalendarProvider`
 * para CalDAV/XML. Acepta un array JSON de objetos por día (el export
 * masivo de bienestar y el endpoint `wellness-service` devuelven ambos
 * esta forma, a veces envuelta en `{ dailySleepDTOs: [...] }` u
 * similar -- por eso también se acepta un objeto con una única
 * propiedad-array). Entradas sin fecha reconocible se descartan
 * silenciosamente (no son un día válido, no un error de todo el
 * archivo); un archivo sin NINGUNA entrada válida sí lanza, para no
 * fingir un import exitoso de cero días.
 */
export class GarminProvider implements WearableProvider {
  readonly kind = "garmin" as const;

  parseExport(raw: string): WearableImportResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("GarminProvider.parseExport: el archivo no es JSON válido.");
    }

    const entries = this.extractEntries(parsed);
    if (entries.length === 0) {
      throw new Error(
        "GarminProvider.parseExport: no se encontró un array de días dentro del archivo (¿formato inesperado?).",
      );
    }

    const dailyMetrics = entries
      .map((entry) => toDailyMetrics(entry))
      .filter((metrics): metrics is DailyWearableMetrics => metrics !== null);

    if (dailyMetrics.length === 0) {
      throw new Error(
        "GarminProvider.parseExport: ninguna entrada tenía una fecha reconocible (calendarDate/CalendarDate/date).",
      );
    }

    return { provider: "garmin", dailyMetrics };
  }

  private extractEntries(parsed: unknown): Record<string, unknown>[] {
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
    }
    if (parsed && typeof parsed === "object") {
      const arrayProperty = Object.values(parsed as Record<string, unknown>).find((value) =>
        Array.isArray(value),
      );
      if (Array.isArray(arrayProperty)) {
        return arrayProperty.filter(
          (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
        );
      }
      // Un solo día suelto (p. ej. una respuesta individual del proxy `dailySleepData`).
      return [parsed as Record<string, unknown>];
    }
    return [];
  }
}
