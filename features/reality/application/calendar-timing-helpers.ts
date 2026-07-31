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

/**
 * Offset (en minutos) de `timeZone` respecto a UTC en el instante
 * `utcGuess` -- misma técnica que ya usa
 * `providers/apple/apple-calendar-mapper.ts` (`resolveUtcOffsetMinutes`)
 * para convertir horas locales de iCal a UTC. Se repite aquí (capa de
 * aplicación) en vez de importarla desde `providers/` porque son capas
 * distintas que no deberían depender una de la otra -- ningún
 * proveedor concreto debería filtrarse hasta el cálculo genérico de
 * fronteras de día.
 */
function resolveUtcOffsetMinutes(utcGuess: Date, timeZone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const parts = formatter.formatToParts(utcGuess);
    const get = (type: string): number => {
      const part = parts.find((entry) => entry.type === type);
      return part ? Number.parseInt(part.value, 10) : 0;
    };

    const asIfUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );

    return (asIfUtc - utcGuess.getTime()) / 60_000;
  } catch {
    // `timeZone` no es un identificador IANA reconocido -- mismo criterio de
    // aproximación a UTC que ya usa `apple-calendar-mapper.ts` en este caso.
    return 0;
  }
}

/**
 * Instante UTC de las 00:00:00 hora local de `timeZone`, en la fecha
 * civil que `date` representa EN esa zona -- reemplazo OPCIONAL de
 * `startOfUtcDay` cuando se conoce la zona horaria real de la persona
 * (ver `features/reality/README.md`, "Timezone real de la persona":
 * aditivo, cero cambio de forma en `CalendarSnapshotOptions`). Quien no
 * pase `timeZone` sigue viendo exactamente el comportamiento de
 * siempre (`startOfUtcDay`) -- este helper nunca se activa solo.
 */
export function startOfDayInZone(date: Date, timeZone: string): Date {
  const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dayFormatter.formatToParts(date);
  const get = (type: string): number => Number.parseInt(parts.find((part) => part.type === type)?.value ?? "0", 10);

  // Medianoche UTC de esa fecha civil -- todavía no es la medianoche real de
  // `timeZone`, es solo el punto de partida para medir el offset real.
  const utcMidnightGuess = new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
  const offsetMinutes = resolveUtcOffsetMinutes(utcMidnightGuess, timeZone);
  return new Date(utcMidnightGuess.getTime() - offsetMinutes * 60_000);
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
