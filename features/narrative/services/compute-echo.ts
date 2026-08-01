import type { NarrativeEcho } from "../domain/narrative-arc";
import type { NarrativeThread } from "../domain/narrative-thread";
import { daysBetween } from "./time-math";

/** Tolerancia en días alrededor del mes+día exacto -- un eco "cae hoy" también cuenta un día antes/después, para no depender de que la visita ocurra en el instante exacto de medianoche del aniversario. */
const ECHO_DAY_TOLERANCE = 1;
/** Mínimo de días reales transcurridos para que un eco cuente -- evita ecos triviales de "hace un par de días" (eso ya lo cubre `isFresh`, señal de "momentum" en `narrative-score.ts`). */
const ECHO_MIN_DAYS = 60;
const DAYS_PER_MONTH = 30;

function matchesTodayCalendarDate(date: Date, now: Date): boolean {
  const dayDiff = Math.abs(date.getDate() - now.getDate());
  return date.getMonth() === now.getMonth() && dayDiff <= ECHO_DAY_TOLERANCE;
}

/**
 * "Time itself is evidence" (Principio 8) -- pura aritmética de fechas
 * sobre `NarrativeChapter.since` de capítulos que `build-threads-from-loops.ts`
 * ya construyó, sin fuente nueva ni LLM. Recorre los capítulos PASADOS
 * de un arco (nunca el actual, que por definición cae "hoy" y no sería
 * un eco de nada) y busca el que caiga en la fecha de hoy (mismo mes +
 * día, con `ECHO_DAY_TOLERANCE`) con al menos `ECHO_MIN_DAYS` reales de
 * por medio. Si varios coinciden, gana el más antiguo -- un eco de un
 * año pesa más que uno de dos meses, y "el más antiguo" es un desempate
 * determinístico, nunca ambiguo.
 */
export function computeEcho(pastChapters: readonly NarrativeThread[], now: Date): NarrativeEcho | null {
  const matches = pastChapters.filter((chapter) => {
    const days = daysBetween(chapter.chapter.since, now);
    return days >= ECHO_MIN_DAYS && matchesTodayCalendarDate(chapter.chapter.since, now);
  });

  if (matches.length === 0) return null;

  const oldest = [...matches].sort((a, b) => a.chapter.since.getTime() - b.chapter.since.getTime())[0];
  const intervalMonths = Math.max(1, Math.round(daysBetween(oldest.chapter.since, now) / DAYS_PER_MONTH));

  return { sourceThreadId: oldest.id, intervalMonths };
}
