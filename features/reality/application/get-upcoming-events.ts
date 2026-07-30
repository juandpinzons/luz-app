import type { CalendarEvent } from "../domain";
import { addUtcDays, eventEnd, eventStart, overlaps, startOfUtcDay } from "./calendar-timing-helpers";

const DEFAULT_WITHIN_DAYS = 7;

export interface GetUpcomingEventsOptions {
  readonly now?: Date;
  readonly withinDays?: number;
  /** Sin límite si se omite -- un consumidor que solo quiere "los próximos 3" lo pide explícitamente. */
  readonly limit?: number;
}

/**
 * Accesor angosto sobre lo mismo que `CalendarSnapshot.upcoming`
 * calcula, para un consumidor que solo necesita esta lista (sin pagar
 * por calcular bloques libres/ocupados/series recurrentes que no va a
 * usar) -- `getCalendarSnapshot()` (`./get-calendar-snapshot`) sigue
 * siendo la fuente completa cuando se necesita más de un pedazo.
 */
export function getUpcomingEvents(
  events: readonly CalendarEvent[],
  options?: GetUpcomingEventsOptions,
): CalendarEvent[] {
  const now = options?.now ?? new Date();
  const windowStart = startOfUtcDay(now);
  const windowEnd = addUtcDays(windowStart, options?.withinDays ?? DEFAULT_WITHIN_DAYS);

  const filtered = events
    .filter((event) => event.status !== "cancelled")
    .filter((event) => overlaps(eventStart(event), eventEnd(event), windowStart, windowEnd))
    .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime());

  return options?.limit !== undefined ? filtered.slice(0, options.limit) : filtered;
}
