import type { NarrativePriority } from "./narrative-priority";
import type { NarrativeRelatedEntity } from "./narrative-related-entity";
import type { NarrativeThread } from "./narrative-thread";

/**
 * Estado del arco completo -- distinto del capítulo actual
 * (`NarrativeChapter.stage`, por capítulo) porque el arco mira su
 * HISTORIA completa, no solo el capítulo de hoy. Cada valor deriva de
 * hechos reales (`ContinuityLoop.state`/`LoopOutcome.kind` de capítulos
 * PASADOS del mismo arco), nunca de una interpretación de cómo se
 * siente la persona -- ver `services/build-arcs.ts`.
 */
export const NARRATIVE_ARC_STATES = [
  /** Capítulo actual no terminal, sin ningún capítulo anterior con desenlace negativo/desconocido/abandonado -- avanza sin sobresaltos conocidos. */
  "active",
  /** Capítulo actual no terminal, Y un capítulo anterior del MISMO arco terminó `negative`/`unknown`/`abandoned` -- un segundo intento real, nunca tratado como si el primero no hubiera existido. */
  "recovering",
  /** Capítulo actual terminal, cerrado hace `REFLECTION_WINDOW_DAYS` o más -- historia asentada, elegible para una revisita futura si aparece evidencia nueva sobre la misma entidad. */
  "dormant",
  /** Capítulo actual terminal, cerrado hace menos de `REFLECTION_WINDOW_DAYS` -- recién concluido. */
  "concluded",
] as const;

export type NarrativeArcState = (typeof NARRATIVE_ARC_STATES)[number];

/**
 * Resurgimiento temporal determinista: un capítulo PASADO de este mismo
 * arco cuya fecha (mes+día de `chapter.since`) coincide con hoy, con
 * suficiente tiempo real transcurrido para que importe -- pura
 * aritmética de fechas sobre datos que el arco ya tiene, sin fuente
 * nueva. Ver `services/compute-echo.ts`.
 */
export interface NarrativeEcho {
  /** `NarrativeThread.id` del capítulo que se repite hoy. */
  readonly sourceThreadId: string;
  /** Meses redondeados desde `sourceThreadId`, siempre en la misma unidad -- nunca un conteo exacto de días, que se sentiría más como un cálculo que como un recuerdo. Un futuro consumidor decide si `12` se dice "hace un año" o "hace 12 meses"; este campo nunca mezcla unidades. */
  readonly intervalMonths: number;
}

/**
 * Un cúmulo determinista de `NarrativeThread` (capítulos, presentes Y
 * pasados) que comparten al menos una `NarrativeRelatedEntity` real --
 * la respuesta concreta a "how does it connect events months apart":
 * dos `ContinuityLoop` de orígenes distintos (un `goal` en febrero, una
 * `recommendation` en julio) sobre el MISMO objetivo son, para el arco,
 * la misma historia vista en dos momentos, nunca dos hechos
 * independientes.
 *
 * Agrupación por ENTIDAD PRIMARIA (la primera `relatedEntities[0]` de
 * cada thread), no por cierre transitivo completo entre conjuntos de
 * entidades -- una simplificación deliberada y documentada: en la
 * práctica cada regla de detección de Continuity ya anota una única
 * entidad principal por loop (ver `core/continuity-engine/detection/`),
 * así que agrupar por la primera es correcto para el caso dominante sin
 * la complejidad de un union-find completo. Un thread sin ninguna
 * entidad relacionada forma su propio arco de un solo capítulo.
 */
export interface NarrativeArc {
  /** = `arc:${entityKey}` o `arc:thread:${threadId}` para arcos de un solo capítulo sin entidad -- ver `services/build-arcs.ts`. */
  readonly key: string;
  /** `null` únicamente para un arco de un solo capítulo sin ninguna entidad relacionada. */
  readonly anchorEntity: NarrativeRelatedEntity | null;
  readonly state: NarrativeArcState;
  /** Cronológico, más antiguo primero -- `chapters[chapters.length - 1] === current`. */
  readonly chapters: readonly NarrativeThread[];
  /** = `chapters[chapters.length - 1]` -- el capítulo de hoy. */
  readonly current: NarrativeThread;
  /**
   * `true` cuando `state === "recovering"` -- expuesto aparte para que
   * un consumidor no tenga que comparar contra el enum; ver Principio 7
   * ("Returning after a setback is not a new story -- it's the same
   * story, continuing").
   */
  readonly isReturningAfterSetback: boolean;
  /** `null` cuando ningún capítulo pasado coincide con la fecha de hoy -- ver `NarrativeEcho`. */
  readonly echo: NarrativeEcho | null;
  /** Score determinístico 0-4 del arco -- ver `services/narrative-score.ts` ("arc resonance"). Puede superar al del capítulo actual solo, nunca ser inferior. */
  readonly score: number;
  readonly priority: NarrativePriority;
}
