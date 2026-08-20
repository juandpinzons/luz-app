/**
 * Bogotá es la única timezone que este código base asume en cualquier
 * lugar (`features/home/services/get-live-calendar-context.ts`,
 * `features/chat/services/calendar-signals.ts`,
 * `features/dashboard/services/build-morning-brief.ts`,
 * `features/presence/services/build-greeting.ts`,
 * `features/orb/services/derive-orb-moment.ts` duplican el mismo
 * literal de forma independiente). Este módulo vive en `core/config/`
 * porque `core/memory-engine` necesita esta misma noción de "hoy" y
 * `core/` no puede importar de `features/` -- no reemplaza esas cinco
 * duplicaciones (migrarlas es un cambio aparte, de bajo riesgo, para
 * no diluir la revisión de este), es la primera fuente de este tipo
 * dentro de `core/`.
 *
 * Colombia no tiene horario de verano (UTC-5 fijo desde 1993) -- el
 * offset fijo de abajo es seguro solo mientras `PERSON_TIME_ZONE` siga
 * siendo Bogotá; una timezone real por persona (fuera de alcance)
 * invalidaría este atajo.
 */
export const PERSON_TIME_ZONE = "America/Bogota";

const PERSON_UTC_OFFSET_HOURS = 5;
const DIACRITICS_PATTERN = /\p{Diacritic}/gu;

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(DIACRITICS_PATTERN, "");
}

export const WEEKDAY_INDEX_BY_NAME: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

export interface PersonCalendarDate {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
  /** 0=domingo .. 6=sábado */
  weekday: number;
}

const calendarFormatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: PERSON_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "long",
});

/** Fecha/día-de-semana de `instant` en hora de Bogotá, no en la del proceso que corre el código. */
export function toPersonCalendarDate(instant: Date): PersonCalendarDate {
  const parts = calendarFormatter.formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  const weekdayName = stripAccents(get("weekday").toLowerCase());
  // `Intl` con `weekday: "long"` en "es-CO" siempre da uno de los 7
  // nombres de WEEKDAY_INDEX_BY_NAME -- comportamiento fijo de ICU,
  // no algo que varíe en tiempo de ejecución.
  const weekday = WEEKDAY_INDEX_BY_NAME[weekdayName]!;

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday,
  };
}

/** Reconstruye un instante real al mediodía Bogotá de esa fecha -- mediodía, no medianoche, para que cualquier bucketing posterior por fecha UTC nunca caiga en el día equivocado. */
export function personCalendarNoonUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12 + PERSON_UTC_OFFSET_HOURS, 0, 0, 0));
}

/** Instante real de medianoche Bogotá de esa fecha -- para límites de rango (inicio de día/mes), no para reconstruir "la fecha de" algo puntual (ver `personCalendarNoonUtc`). */
export function personCalendarStartOfDayUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, PERSON_UTC_OFFSET_HOURS, 0, 0, 0));
}
