import {
  personCalendarNoonUtc,
  stripAccents,
  toPersonCalendarDate,
  WEEKDAY_INDEX_BY_NAME,
  type PersonCalendarDate,
} from "../../config/person-time-zone";

/**
 * Determinístico, no todavía inteligente -- mismo criterio que
 * `DeterministicMemoryClassifier`. No es un `CaptureStage` ni una
 * estrategia intercambiable por DI: la decisión ocurre ANTES de
 * `.capture()`, igual que `detectCrisisSignal`/`detectImageGenerationRequest`
 * deciden cosas sobre `input.message` antes de capturar. Una mejora
 * futura con IA no reemplazaría esta función en este mismo punto --
 * viviría en el Knowledge Engine asíncrono (ver `ai-concept-extraction-strategy.ts`),
 * nunca en el turno vivo de chat.
 *
 * Reconoce, en orden de prioridad (más específico gana): fecha
 * explícita ("16 de agosto", "8/16"), nombre de día de la semana
 * ("el domingo" -- siempre el más reciente en el pasado, nunca
 * futuro), términos relativos ("ayer", "hace 3 días"). Nunca produce
 * una fecha futura: quien cuenta algo ya ocurrido usa tiempo pasado.
 * Si la fecha resuelta es HOY, devuelve `null` en vez de degradar
 * `userMessage.createdAt` (ya preciso) a un mediodía reconstruido.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

const MONTH_INDEX_BY_NAME: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const SPANISH_NUMBER_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
};

/**
 * Mismo criterio que `IDIOM_SUFFIXES` en `detect-crisis-signal.ts`:
 * lista corta que se extiende con casos reales, no exhaustiva por
 * anticipación. Sin esto, "1/2 pastilla" o "3/4 de hora" se
 * malinterpretarían como fechas.
 */
const COMMON_FRACTION_DENYLIST = new Set(["1/2", "1/3", "2/3", "1/4", "3/4"]);

const EXPLICIT_MONTH_NAME_PATTERN =
  /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/;
const EXPLICIT_NUMERIC_PATTERN = /\b(\d{1,2})\/(\d{1,2})\b/;
const WEEKDAY_PATTERN =
  /\b(?:(?:el|este|pasado)\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/;
const RELATIVE_DAYS_AGO_PATTERN = /\bhace\s+([a-z0-9]+)\s+dias?\b/;

/** `weekday` no aplica a una fecha explícita ("16 de agosto") hasta que se resuelve -- por eso este tipo, más angosto que `PersonCalendarDate`, en vez de un valor sentinel inventado. */
interface ResolvedDate {
  year: number;
  month: number;
  day: number;
}

function isFutureRelativeToToday(
  candidate: ResolvedDate,
  today: ResolvedDate,
): boolean {
  if (candidate.month !== today.month) return candidate.month > today.month;
  return candidate.day > today.day;
}

function resolveNumericDayMonth(
  a: number,
  b: number,
): { day: number; month: number } | null {
  if (a < 1 || a > 31 || b < 1 || b > 31) return null;
  if (a > 12 && b > 12) return null;
  if (a > 12) return { day: a, month: b };
  if (b > 12) return { day: b, month: a };
  return { day: a, month: b };
}

function fromDaysAgo(today: ResolvedDate, daysAgo: number): ResolvedDate {
  const anchor = personCalendarNoonUtc(today.year, today.month, today.day);
  return toPersonCalendarDate(new Date(anchor.getTime() - daysAgo * DAY_MS));
}

function isSameDate(a: ResolvedDate, b: ResolvedDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function extractOccurredAt(content: string, referenceInstant: Date): Date | null {
  const normalized = stripAccents(content.toLowerCase());
  const today: PersonCalendarDate = toPersonCalendarDate(referenceInstant);

  let resolved: ResolvedDate | null = null;

  const monthNameMatch = normalized.match(EXPLICIT_MONTH_NAME_PATTERN);
  if (monthNameMatch) {
    const day = Number(monthNameMatch[1]);
    const month = MONTH_INDEX_BY_NAME[monthNameMatch[2]];
    if (day >= 1 && day <= 31 && month) {
      resolved = { year: today.year, month, day };
    }
  }

  if (!resolved) {
    const numericMatch = normalized.match(EXPLICIT_NUMERIC_PATTERN);
    if (numericMatch && !COMMON_FRACTION_DENYLIST.has(numericMatch[0])) {
      const dayMonth = resolveNumericDayMonth(
        Number(numericMatch[1]),
        Number(numericMatch[2]),
      );
      if (dayMonth) {
        resolved = { year: today.year, month: dayMonth.month, day: dayMonth.day };
      }
    }
  }

  if (resolved && isFutureRelativeToToday(resolved, today)) {
    resolved = { ...resolved, year: resolved.year - 1 };
  }

  if (!resolved) {
    const weekdayMatch = normalized.match(WEEKDAY_PATTERN);
    if (weekdayMatch) {
      const targetWeekday = WEEKDAY_INDEX_BY_NAME[weekdayMatch[1]];
      const daysAgo = (today.weekday - targetWeekday + 7) % 7;
      resolved = fromDaysAgo(today, daysAgo);
    }
  }

  if (!resolved) {
    if (/\bhoy\b/.test(normalized)) {
      resolved = today;
    } else if (/\banteayer\b|\bantier\b/.test(normalized)) {
      resolved = fromDaysAgo(today, 2);
    } else if (/\bayer\b/.test(normalized)) {
      resolved = fromDaysAgo(today, 1);
    } else {
      const daysAgoMatch = normalized.match(RELATIVE_DAYS_AGO_PATTERN);
      if (daysAgoMatch) {
        const raw = daysAgoMatch[1];
        const n = /^\d+$/.test(raw) ? Number(raw) : SPANISH_NUMBER_WORDS[raw];
        if (n && n >= 1 && n <= 999) {
          resolved = fromDaysAgo(today, n);
        }
      }
    }
  }

  if (!resolved || isSameDate(resolved, today)) return null;

  return personCalendarNoonUtc(resolved.year, resolved.month, resolved.day);
}
