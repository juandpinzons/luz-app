import type { RealityChange } from "../../experience/domain/experience-state";
import type { NarrativeContinuation } from "./narrative-continuation";
import type { NarrativeMoment } from "./narrative-moment";
import type { NarrativeThread } from "./narrative-thread";

/**
 * Salida determinística única de "Living Narrative Foundation". Responde
 * la pregunta que le da nombre a la misión: de todo lo que Memory,
 * Knowledge, Reality, Experience y Continuity ya decidieron, ¿qué
 * historia está activa, en qué capítulo, qué cambió desde la última
 * visita, y qué merece continuación, celebración o silencio?
 *
 * Cada arreglo de abajo (salvo `celebrationCandidates`) es un FILTRO
 * sobre el mismo pool de `NarrativeThread` que ya construyó
 * `services/build-threads-from-loops.ts` -- las categorías se solapan a
 * propósito (una historia puede ser `openStories` Y
 * `longRunningStories` Y `storiesWaitingQuietly` al mismo tiempo), mismo
 * criterio ya documentado en `features/home/README.md` ("Attention
 * Needed y Recommendations son el mismo dato"): exponerlas ya
 * particionadas ahorra a cada consumidor futuro reimplementar el mismo
 * filtro, nunca representa una segunda decisión independiente que pueda
 * contradecir a la primera.
 */
export interface NarrativeState {
  /** Mismo instante que `HomeState.asOf`/`ExperienceState.asOf` -- único timestamp de referencia para todo el objeto. */
  readonly asOf: Date;

  /**
   * "Current Active Story" -- la única historia que debería liderar
   * ahora mismo, o `null` cuando de verdad no hay ninguna (cuenta vacía,
   * cero `ContinuityLoop` reales). Nunca se fabrica una para llenar el
   * espacio -- mismo principio que `ExperienceState.primary`. Solo puede
   * salir de un `NarrativeThread` real (ver `NarrativeCandidate`): un
   * momento de un solo instante nunca es "la historia activa".
   */
  readonly currentActiveStory: NarrativeThread | null;

  /** Cómo retomar `currentActiveStory` -- `null` únicamente cuando `currentActiveStory` también lo es. Ver `NarrativeContinuation`. */
  readonly continuation: NarrativeContinuation | null;

  /**
   * "Recent Changes" -- passthrough exacto de `ExperienceState.whatChanged`.
   * Experience ya resuelve esta pregunta exacta comparando la huella de
   * esta visita contra la anterior (`RealityFingerprint`); recalcularla
   * aquí sería la misma "lógica de ranking duplicada" que Home/Experience
   * ya advierten evitar en sus propios README.
   */
  readonly recentChanges: readonly RealityChange[];

  /** "Open Stories" -- capítulo en `beginning`/`developing`/`waiting`/`turning_point` (cualquier `LoopState` no terminal). */
  readonly openStories: readonly NarrativeThread[];

  /** "Recently Closed Stories" -- capítulo `resolution` o `reflection` (terminal, cerrado hace menos de `REFLECTION_WINDOW_DAYS`). */
  readonly recentlyClosedStories: readonly NarrativeThread[];

  /**
   * "Celebration Candidates" -- momentos reales que merecen
   * reconocimiento: historias en capítulo `resolution` con desenlace
   * positivo, más `NarrativeMoment` sueltos derivados de una
   * recomendación `CELEBRATE_PROGRESS` real. Nunca inventado -- ver
   * `services/build-celebration-candidates.ts`.
   */
  readonly celebrationCandidates: readonly NarrativeMoment[];

  /** "Long-running Stories" -- no terminal, con `ageDays >= LONG_RUNNING_THRESHOLD_DAYS`. */
  readonly longRunningStories: readonly NarrativeThread[];

  /** "Stories Ready For Reflection" -- capítulo exactamente `reflection`. */
  readonly storiesReadyForReflection: readonly NarrativeThread[];

  /** "Stories Ready For Follow-up" -- capítulo exactamente `turning_point` (`loop.state === "follow_up"`). */
  readonly storiesReadyForFollowUp: readonly NarrativeThread[];

  /**
   * "Stories Ready To Be Forgotten" -- no terminal, acercándose al propio
   * umbral de `detectTimeoutExceeded` (`core/continuity-engine`) sin
   * haberlo alcanzado todavía. Aviso honesto, nunca una decisión de
   * cerrar -- Narrative jamás transiciona un loop (`Never reopen closed
   * Continuity Loops` aplica en espíritu: tampoco cierra uno abierto).
   */
  readonly storiesReadyToBeForgotten: readonly NarrativeThread[];

  /** "Stories Waiting Quietly" -- capítulo exactamente `waiting`. */
  readonly storiesWaitingQuietly: readonly NarrativeThread[];
}
