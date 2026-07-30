import type { CalendarEvent } from "../domain";

/**
 * Helpers internos compartidos entre `get-calendar-snapshot.ts` y
 * `get-upcoming-events.ts` -- no se exportan desde `index.ts` a
 * propósito, son detalle de implementación de este módulo, no parte
 * de la superficie pública de casos de uso.
 *
 * Límite documentado: todos los cálculos de "hoy"/ventana usan
 * fronteras de día en UTC, nunca la zona horaria real de la persona
 * (que este cimiento no recibe en ningún parámetro hoy). Un evento
 * con hora que empieza a las 11pm hora local de la persona pero cruza
 * medianoche UTC puede clasificarse en el día UTC equivocado -- mejora
 * futura documentada en el README, no resuelta aquí para no inventar
 * una fuente de zona horaria que nadie pidió.
 */

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function eventStart(event: CalendarEvent): Date {
  return event.timing.isAllDay ? new Date(`${event.timing.date}T00:00:00Z`) : event.timing.dateTime;
}

export function eventEnd(event: CalendarEvent): Date {
  return event.timing.isAllDay
    ? new Date(`${event.timing.endDate}T00:00:00Z`)
    : event.timing.endDateTime;
}

/**
 * `[aStart, aEnd)` se solapa con `[bStart, bEnd)` -- semiabierto en
 * ambos lados, mismo criterio que `endDate`/`endDateTime` en
 * `CalendarEventTiming` (fin exclusivo). Caso especial: un evento de
 * duración cero (`aStart === aEnd`, "instante puntual", ver
 * `apple-calendar-mapper.ts`) se trata como el PUNTO `aStart` cayendo
 * dentro de `[bStart, bEnd)` -- sin este caso especial, un evento
 * puntual exactamente en el borde de la ventana nunca aparecería en
 * ningún lado.
 */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  if (aStart.getTime() === aEnd.getTime()) {
    return aStart.getTime() >= bStart.getTime() && aStart.getTime() < bEnd.getTime();
  }
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export function durationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}
