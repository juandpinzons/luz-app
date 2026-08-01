import type { NarrativePriority } from "./narrative-priority";
import type { NarrativeReason } from "./narrative-reason";
import type { NarrativeRelatedEntity } from "./narrative-related-entity";

/**
 * Algo real que vale la pena notar HOY, sin (todavía) tener su propio
 * `NarrativeThread` -- nunca tiene capítulo ni progresión, porque no es
 * una historia rastreada a través de visitas, es un instante. Ejemplos
 * reales: una reunión de calendario sin loop propio, un correo
 * importante sin leer, una recomendación `CELEBRATE_PROGRESS` que no
 * llegó a abrir un loop. Si Continuity decide después que este asunto
 * merece seguimiento real, un `ContinuityLoop` nuevo lo cubre la
 * siguiente vez -- Narrative nunca decide eso por su cuenta, solo lo
 * refleja (`Never invent events`).
 *
 * `title`/`detail` son siempre passthrough de un campo ya existente
 * (`CalendarEvent.title`, `EmailMessage.subject`,
 * `FollowUpRecommendation.title`/`.explanation`,
 * `DueLifeItem.title`) -- nunca texto nuevo, mismo criterio que
 * `NarrativeThread`.
 */
export interface NarrativeMoment {
  /** Identidad estable entre visitas (p. ej. `calendar:${event.id}`, `email:${message.id}`) -- nunca el slot en el que cayó. */
  readonly key: string;
  readonly title: string;
  readonly detail: string;
  readonly priority: NarrativePriority;
  readonly reason: NarrativeReason;
  /** Score determinístico 0-4, mismo cómputo que `NarrativeThread.score` -- ver `services/narrative-score.ts`. */
  readonly score: number;
  readonly relatedEntities: readonly NarrativeRelatedEntity[];
  /**
   * Presente únicamente cuando este momento corresponde EXACTAMENTE al
   * mismo asunto que un `NarrativeThread` ya rastreado -- correlación
   * exacta por `LoopTrigger.sourceId` (nunca aproximada), ver
   * `services/build-moments.ts`. Permite a un consumidor evitar tratar
   * el momento y el thread como dos hechos independientes cuando en
   * realidad son la misma cosa vista desde dos ángulos.
   */
  readonly relatedThreadId?: string;
}
