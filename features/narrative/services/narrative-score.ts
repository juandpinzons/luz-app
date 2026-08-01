import type { NarrativePriority } from "../domain/narrative-priority";

const MIN_SCORE = 0;
const MAX_SCORE = 4;

/** Ventana en la que "cambió de verdad" sigue contando como movimiento real -- mismo orden de magnitud que `RESOLUTION_FRESH_DAYS` (`build-threads-from-loops.ts`): unos pocos días, nunca "toda la semana". */
export const FRESHNESS_WINDOW_DAYS = 2;

/** A cuántas horas de distancia un ancla real (evento de calendario, `ContinuityLoop.nextFollowUpAt`) ya cuenta como "se acerca" -- generoso a propósito (2 días), ni tan corto que solo capture "hoy mismo" ni tan largo que pierda sentido frente a la ventana de 14 días que ya usa `LifeDashboardSnapshot.upcoming`. */
export const CALENDAR_PROXIMITY_WINDOW_HOURS = 48;

/** Piso de score para una candidata de celebración real -- ver docblock de `computeNarrativeScore` para el porqué de que sea un piso y no un bono. */
export const CELEBRATION_SCORE_FLOOR = 2;

/**
 * Entradas normalizadas del ranking -- la misma forma sirve para un
 * `NarrativeThread` (respaldado por un `ContinuityLoop`) y para un
 * `NarrativeMoment` (sin loop propio), para que el peso de cada señal se
 * defina UNA sola vez sin importar de dónde salió la candidata (mismo
 * principio anti-duplicación que ya aplica en todo el resto del repo).
 */
export interface NarrativeScoreInput {
  /** 0-4, ya mapeado desde la escala de prioridad de origen (`LoopPriority`/`RecommendationPriority`/`EmailImportance`) -- ver el `services/build-*.ts` correspondiente para su lookup exacto. */
  readonly basePoints: number;
  /** Señal "freshness"/"recency": algo cambió de verdad hace menos de `FRESHNESS_WINDOW_DAYS`. */
  readonly isFresh: boolean;
  /** Señal "continuity": ya tiene al menos un ciclo de seguimiento real (`ContinuityLoop.followUpAttempts >= 1`) -- nunca una historia que apenas empieza. */
  readonly isContinuingStory: boolean;
  /** Señal "follow-up urgency": el momento programado para resurfacear ya se cumplió (`loop.state === "follow_up"`). */
  readonly isFollowUpDue: boolean;
  /** Señal "calendar proximity": horas hasta el ancla real más cercana (evento de calendario correlacionado, o `nextFollowUpAt`) -- `null` cuando no hay ninguna ancla real conocida. */
  readonly calendarProximityHours: number | null;
  /** Señal "emotional weight": peso FIJO por categoría ya clasificada (`LoopReason === "relationship_milestone"`/`"significant_life_event"`) -- nunca una lectura del contenido real ni una afirmación sobre cómo se siente la persona. Ver nota completa en `computeNarrativeScore`. */
  readonly hasFixedEmotionalWeight: boolean;
  /** Señal "user attention": Presence/Home ya decidieron que esta misma entidad merece el foco de la persona (`HomeState.currentFocus`) -- Narrative nunca calcula su propia versión de esto, solo la reusa. */
  readonly hasUserAttention: boolean;
  /** Señal "story age": no terminal, abierta hace `LONG_RUNNING_THRESHOLD_DAYS` o más. */
  readonly isLongRunningOpen: boolean;
  /** Señal "celebration value": desenlace positivo real o recomendación `CELEBRATE_PROGRESS` real. */
  readonly isCelebration: boolean;
}

function clampScore(value: number): number {
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, value));
}

/**
 * Ranking determinístico -- misión: "Design deterministic ranking...
 * Document every weight." Escala 0-4, misma escala y misma disciplina
 * que `ExperienceCard.importance` (`features/experience/`): la base (lo
 * que Continuity/Dashboard ya decidieron) domina, y cada grupo de
 * señales adicionales aporta como mucho **+1** -- igual que el único
 * modificador que ya usa Experience (`LOAD_MODIFIER`, ±1), para que
 * ningún cruce de señales menores pueda superar por sí solo a una
 * prioridad base real.
 *
 * Los nueve nombres de señal que sugiere la misión (importance,
 * freshness, continuity, recency, emotional weight, user attention,
 * calendar proximity, follow-up urgency, story age) se agrupan en TRES
 * bits honestos, no nueve sumandos independientes -- así ninguna
 * combinación accidental de señales débiles puede empujar una candidata
 * irrelevante por encima de una genuinamente importante:
 *
 * - **Momentum** (freshness + continuity + follow-up urgency, +1): el
 *   asunto se está moviendo AHORA -- el reloj que Continuity programó ya
 *   se cumplió (`isFollowUpDue`), o cambió de verdad hace poco Y ya
 *   tiene trayectoria real de seguimiento (`isFresh && isContinuingStory`,
 *   nunca una historia recién detectada).
 * - **External pull** (calendar proximity + user attention + emotional
 *   weight, +1): algo FUERA de esta historia ya apunta hacia ella -- un
 *   ancla real dentro de `CALENDAR_PROXIMITY_WINDOW_HOURS`, o
 *   Presence/Home ya decidieron que merece el foco de la persona, o su
 *   categoría ya trae un peso fijo más alto.
 * - **Longevity** (story age, +1): no terminal, `LONG_RUNNING_THRESHOLD_DAYS`
 *   o más sin resolverse -- reconocimiento real a la continuidad, nunca
 *   "vieja = importante" sin más (una historia ya cerrada no califica).
 *
 * `emotional weight` -- nota obligatoria por la regla "Never infer
 * emotional state": `hasFixedEmotionalWeight` es un lookup ESTÁTICO por
 * categoría ya clasificada por Continuity (`LoopReason`), nunca una
 * lectura del contenido real de una Memory/mensaje ni una afirmación
 * sobre cómo se siente la persona -- mismo tipo de decisión que
 * `BASE_CONFIDENCE`/`TYPE_SEVERITY`
 * (`features/dashboard/services/build-follow-up-recommendations.ts`):
 * un peso fijo por categoría, documentado, nunca una inferencia nueva.
 *
 * `celebration value` -- no es un bono aditivo, es un PISO
 * (`CELEBRATION_SCORE_FLOOR`): una celebración real vale la pena
 * mencionar incluso cuando ninguna otra señal la respalda (mismo
 * espíritu que `CELEBRATION_IMPORTANCE` en `features/experience/`), pero
 * el piso es deliberadamente MEDIO, nunca el máximo -- una historia
 * genuinamente crítica sigue pudiendo ganarle. Nunca resta: una
 * celebración cuyo score ya iguala o supera el piso no cambia.
 */
export function computeNarrativeScore(input: NarrativeScoreInput): number {
  const momentum = input.isFollowUpDue || (input.isFresh && input.isContinuingStory);
  const externalPull =
    (input.calendarProximityHours !== null && input.calendarProximityHours <= CALENDAR_PROXIMITY_WINDOW_HOURS) ||
    input.hasUserAttention ||
    input.hasFixedEmotionalWeight;
  const longevity = input.isLongRunningOpen;

  const raw =
    input.basePoints + (momentum ? 1 : 0) + (externalPull ? 1 : 0) + (longevity ? 1 : 0);
  const score = clampScore(raw);

  return input.isCelebration ? Math.max(score, CELEBRATION_SCORE_FLOOR) : score;
}

/**
 * Mismos cuatro cortes que ya separan cualquier escala 0-4 en el repo
 * (`ExperienceCard.importance`) -- consistente para quien ya conoce esa
 * escala. El techo (`score >= 4`, "critical") es alcanzable de dos formas
 * honestas: una prioridad base ya `critical` por sí sola, o una base
 * `high` (3) más al menos uno de los tres grupos de bono -- nunca por
 * acumular bonos sin ninguna base real (una candidata `low` con los tres
 * grupos activos llega como mucho a `4` (`1+3`), el mismo techo, solo
 * alcanzable cuando las TRES señales adicionales convergen a la vez, no
 * con una sola).
 */
const PRIORITY_THRESHOLDS: ReadonlyArray<readonly [number, NarrativePriority]> = [
  [4, "critical"],
  [3, "high"],
  [2, "medium"],
];

export function derivePriorityFromScore(score: number): NarrativePriority {
  for (const [threshold, priority] of PRIORITY_THRESHOLDS) {
    if (score >= threshold) return priority;
  }
  return "low";
}
