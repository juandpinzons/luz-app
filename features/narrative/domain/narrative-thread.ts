import type { LoopOrigin } from "../../../core/continuity-engine";
import type { NarrativeChapter } from "./narrative-progression";
import type { NarrativePriority } from "./narrative-priority";
import type { NarrativeReason } from "./narrative-reason";
import type { NarrativeRelatedEntity } from "./narrative-related-entity";

/**
 * Una historia real, rastreada a través de visitas -- 1:1 con un
 * `ContinuityLoop` real, siempre. Nunca se sintetiza un `NarrativeThread`
 * a partir de otra cosa: un `ContinuityLoop` YA ES "un asunto real que
 * LUZ decidió mantener vivo hasta un desenlace real" (ver
 * `core/continuity-engine/README.md`), que es exactamente la definición
 * de una historia con capítulos. Todo lo demás que Narrative consume
 * (calendario, correo, recomendaciones, lo que Experience ya arbitró)
 * puede CORRELACIONAR con un thread existente o convertirse en un
 * `NarrativeMoment` de un solo instante -- nunca en un `NarrativeThread`
 * propio, para no inventar una segunda noción de "ciclo de vida" que
 * Continuity no decidió.
 *
 * `title`/`summary` son passthrough exacto de `loop.title`/
 * `loop.trigger.summary` -- Narrative nunca redacta texto nuevo, mismo
 * criterio que `toExperienceCard` (`features/continuity/integrations/`).
 */
export interface NarrativeThread {
  /** Igual a `ContinuityLoop.id` -- un thread nunca tiene una identidad propia distinta de su loop de origen. */
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly origin: LoopOrigin;
  readonly chapter: NarrativeChapter;
  readonly priority: NarrativePriority;
  /** La razón más específica que aplica ahora mismo -- ver `services/derive-reason.ts` para el orden de desempate cuando varias son ciertas. */
  readonly reason: NarrativeReason;
  /** Score determinístico 0-4, ver `services/narrative-score.ts` -- expuesto para que un consumidor pueda ordenar sin volver a calcular nada. */
  readonly score: number;
  /** Días desde `ContinuityLoop.createdAt` -- edad real de la historia, nunca de esta visita. */
  readonly ageDays: number;
  /**
   * No terminal y `ageDays >= LONG_RUNNING_THRESHOLD_DAYS` -- expuesto
   * como hecho propio (no solo inferible de `reason`) porque `reason`
   * puede estar ocupado por algo más específico (p. ej. `follow_up_due`)
   * incluso cuando esto también es cierto -- `services/categorize-threads.ts`
   * filtra sobre este campo directamente, nunca sobre `reason`.
   */
  readonly isLongRunning: boolean;
  /**
   * No terminal, acercándose al propio umbral de `detectTimeoutExceeded`
   * (`core/continuity-engine`) sin haberlo alcanzado -- mismo motivo que
   * `isLongRunning` para exponerlo aparte de `reason`.
   */
  readonly isFadingWithoutEvidence: boolean;
  /**
   * `true` cuando este capítulo cerró SIN un desenlace positivo --
   * `state === "resolved"` con `outcome.kind !== "positive"`, o
   * `state === "abandoned"`. Deliberadamente NO incluye `archived`
   * (el sistema simplemente dejó de rastrear, sin desenlace ni bueno ni
   * malo -- ver `LoopState`) ni `transformed` (el asunto siguió
   * adelante como otra cosa, no es un revés). Único hecho que
   * `services/build-arcs.ts` necesita para reconocer un intento
   * posterior como recuperación (Principio 7) -- nunca una lectura de
   * cómo se siente la persona, solo de qué desenlace real capturó
   * Continuity.
   */
  readonly endedAsSetback: boolean;
  /** Passthrough exacto de `ContinuityLoop.relatedEntities`. */
  readonly relatedEntities: readonly NarrativeRelatedEntity[];
  /**
   * Identidad del `NarrativeArc` al que pertenece este capítulo -- ver
   * `domain/narrative-arc.ts` y `services/build-arcs.ts`. Siempre
   * presente: un thread sin ninguna entidad relacionada en común con
   * otro forma un arco de un solo capítulo (`arc:thread:${id}`), nunca
   * queda huérfano.
   */
  readonly arcKey: string;
}
