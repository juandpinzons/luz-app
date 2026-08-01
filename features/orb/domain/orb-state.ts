import type { OrbPaletteName } from "./orb-palette";

export type OrbMaturityStage = "spark" | "steady" | "radiant";

/**
 * Franja horaria real (hora de Bogotá) -- nunca una hora exacta, solo
 * el cubo que ya usa el resto de LUZ para saludar
 * (`timeOfDayBucket`/`buildGreeting`). Vocabulario propio del orbe
 * (no reexporta el de `generate-welcome.ts`) porque el orbe solo
 * necesita distinguir 4 franjas para el matiz de luz, no las mismas
 * etiquetas de saludo.
 */
export const ORB_TIME_OF_DAY = ["dawn", "morning", "afternoon", "night"] as const;
export type OrbTimeOfDay = (typeof ORB_TIME_OF_DAY)[number];

/**
 * "Emoción a través de la realidad" (Misión "Orb Experience V1"):
 * cada campo es una observación puntual y verificable, nunca una
 * inferencia sobre el estado de ánimo o la personalidad de la
 * persona. Todos pueden ser `false`/neutrales a la vez -- eso ES el
 * "estado calmo" (Objetivo A), no un caso especial.
 *
 * Fuente de cada campo (`derive-orb-moment.ts`): tiempo real (`now`),
 * la memoria más reciente (`RealitySnapshot.memory`), el tiempo desde
 * el último mensaje (`GenerateWelcomeInput`), el calendario real
 * (`HomeCalendarContext`), y objetivos/proyectos/relaciones
 * recientemente actualizados (`core/life`) -- el subconjunto de
 * "Allowed inputs" de la misión que ya está disponible, barato y
 * determinista en el momento en que se genera la bienvenida del chat.
 */
export interface OrbMoment {
  timeOfDay: OrbTimeOfDay;
  /** Una memoria real se capturó en las últimas horas -- "después de una conversación con contenido real". */
  hadMeaningfulConversationRecently: boolean;
  /** Han pasado varios días reales sin un mensaje -- nunca decorativo, siempre la misma métrica que ya decide el saludo de "regreso". */
  hasBeenQuiet: boolean;
  /** Hay una reunión real por empezar pronto o en curso ahora mismo (Calendar Foundation). */
  hasImportantMeetingSoon: boolean;
  /** Un Goal o Project real pasó a `completed` en los últimos días. */
  completedSomethingRecently: boolean;
  /** Una Relationship real se actualizó (una nota nueva, un reencuentro registrado) en los últimos días. */
  reconnectedRecently: boolean;
}

/**
 * Todo lo que la realidad ya decidió sobre esta persona y este
 * momento, ANTES de traducirlo a números de animación (esa traducción
 * es `derive-orb-animation.ts`, deliberadamente un paso aparte --
 * Objetivo E: "separar cómputo de estado / paleta / modelo de
 * animación / render"). `warmth`/`anticipation` sí son señales reales
 * de la relación (nunca decorativas); `paletteName` es la única
 * excepción -- identidad estable, no una señal (ver
 * `domain/orb-palette.ts`).
 */
export interface OrbState {
  paletteName: OrbPaletteName;
  maturityStage: OrbMaturityStage;
  /** 0 (apenas empezando) a 1 (relación asentada). */
  warmth: number;
  /** Hay una hipótesis en formación, una pregunta pendiente o algo por vencer pronto. */
  anticipation: boolean;
  moment: OrbMoment;
}

/**
 * Estado neutral -- ningún momento real activo, la misma presencia
 * que el orbe siempre tuvo antes de esta misión. Para cuando todavía
 * no hay datos reales (p. ej. mientras `/api/chat/welcome` sigue en
 * vuelo) o como respaldo ante una falla -- nunca "roto", nunca
 * fabricado, literalmente "nada que contar todavía".
 */
export const NEUTRAL_ORB_STATE: OrbState = {
  paletteName: "amber",
  maturityStage: "steady",
  warmth: 0.45,
  anticipation: false,
  moment: {
    timeOfDay: "afternoon",
    hadMeaningfulConversationRecently: false,
    hasBeenQuiet: false,
    hasImportantMeetingSoon: false,
    completedSomethingRecently: false,
    reconnectedRecently: false,
  },
};
