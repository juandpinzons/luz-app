import type { ExternalSignal } from "../../../core/reality";
import type { WearableSnapshot } from "../../reality/domain";

/**
 * Pura a propósito -- mismo criterio de separación que
 * `calendar-signals.ts`: sin esto, cualquier import arrastraría
 * `core/wearable-metrics` (I/O real), rompiendo la posibilidad de
 * probar esto con un fixture en memoria.
 *
 * Deliberadamente NO convierte cada métrica del día en una señal --
 * solo lo que ya cruzó un umbral real (`lowSleepAlert`/
 * `elevatedStressAlert`, calculados en `getWearableSnapshot`). Recitar
 * pasos/sueño/estrés en cada turno sería ruido, no acompañamiento --
 * mismo espíritu que el resto de `core/reality` ("ocasionalmente
 * sorprender", no un dashboard leído en voz alta).
 */
export function buildWearableSignals(snapshot: WearableSnapshot | null): ExternalSignal[] {
  if (!snapshot || !snapshot.hasData || !snapshot.latestDay) {
    return [];
  }

  const { latestDay } = snapshot;
  const occurredAt = new Date(`${latestDay.date}T12:00:00Z`);
  const signals: ExternalSignal[] = [];

  if (snapshot.lowSleepAlert && latestDay.sleep) {
    const hours = Math.floor(latestDay.sleep.totalMinutes / 60);
    const minutes = latestDay.sleep.totalMinutes % 60;
    signals.push({
      source: "sensor",
      content: `Según su reloj, anoche durmió ${hours}h ${minutes}min -- por debajo de lo que suele ser un descanso completo.`,
      occurredAt,
    });
  }

  if (snapshot.elevatedStressAlert && latestDay.averageStressLevel !== undefined) {
    signals.push({
      source: "sensor",
      content: `Según su reloj, su nivel de estrés promedio de hoy está elevado (${latestDay.averageStressLevel}/100).`,
      occurredAt,
    });
  }

  return signals;
}
