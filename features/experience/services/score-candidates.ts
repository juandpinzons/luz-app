import type { HomeCalendarContext } from "../../home/domain/home-state";
import type { ExperienceCard } from "../domain/experience-state";

/**
 * Forma del día, en términos de cuánta atención ya está comprometida
 * con el calendario -- no una tarjeta más, un modificador (Fase 4:
 * "Calendar debe modificar prioridades. Nunca comportarse como un
 * widget aislado"). Fabricar una tarjeta separada de "tu día está
 * lleno" habría sido justo el tipo de widget aislado que la misión
 * pide evitar; en cambio, esto sube o baja la importancia de TODO lo
 * demás.
 */
export const CALENDAR_LOADS = ["light", "normal", "overloaded"] as const;
export type CalendarLoad = (typeof CALENDAR_LOADS)[number];

/** A partir de cuántos eventos hoy el día cuenta como "lleno" -- umbral fijo, nunca una puntuación. */
const OVERLOADED_EVENT_COUNT = 5;

export function computeCalendarLoad(calendar: HomeCalendarContext | null): CalendarLoad {
  // Sin calendario conectado no hay señal real de carga -- neutral, nunca se fabrica una.
  if (!calendar) return "normal";
  if (calendar.today.length === 0) return "light";
  if (calendar.today.length >= OVERLOADED_EVENT_COUNT) return "overloaded";
  return "normal";
}

const MIN_IMPORTANCE = 0;
const MAX_IMPORTANCE = 4;

function clampImportance(value: number): number {
  return Math.min(MAX_IMPORTANCE, Math.max(MIN_IMPORTANCE, value));
}

/**
 * Día lleno: la atención ya está comprometida con reuniones reales --
 * solo debería competir con eso algo genuinamente importante, así que
 * todo lo que no sea del calendario mismo pierde un punto. Día vacío:
 * nada compite por el tiempo de la persona, así que hay espacio real
 * para una sugerencia proactiva (un objetivo estancado, una relación
 * descuidada) que en un día normal se habría quedado en `secondary`.
 * Ninguna categoría cambia de signo por esto -- solo sube o baja un
 * punto dentro de la misma escala 0-4.
 */
const LOAD_MODIFIER: Record<CalendarLoad, number> = {
  overloaded: -1,
  light: 1,
  normal: 0,
};

/**
 * Aplica el modificador de carga de calendario a cada candidata que no
 * sea, ella misma, un `calendar_moment` -- una reunión en curso ya es
 * importante por lo que es, nunca se le resta ni se le suma por la
 * forma general del día. Determinístico: mismas candidatas + misma
 * carga siempre producen las mismas importancias.
 */
export function scoreCandidates(candidates: ExperienceCard[], load: CalendarLoad): ExperienceCard[] {
  const modifier = LOAD_MODIFIER[load];
  if (modifier === 0) return candidates;

  return candidates.map((candidate) =>
    candidate.category === "calendar_moment"
      ? candidate
      : { ...candidate, importance: clampImportance(candidate.importance + modifier) },
  );
}
