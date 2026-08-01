import type { NarrativeEcho } from "./narrative-arc";
import type { NarrativeReason } from "./narrative-reason";

/**
 * CÓMO retomar `NarrativeState.currentActiveStory` -- la respuesta
 * concreta a "what deserves continuation" del objetivo de la misión.
 * Unión cerrada -- nunca una decisión inventada sin una razón real
 * detrás. Es un `kind`, no una frase: Narrative decide QUÉ TIPO de
 * continuación aplica, nunca redacta la continuación en sí (eso es
 * trabajo de un futuro consumidor -- Presence, Conversation Strategy,
 * Morning Brief -- nunca de este módulo).
 *
 * `welcome_back`/`echo` se evalúan a nivel de ARCO, ANTES que el resto
 * (que sigue derivando 1:1 de `NarrativeReason` del capítulo actual) --
 * ver `services/build-continuation.ts`.
 */
export const NARRATIVE_CONTINUATION_KINDS = [
  /** `arc.isReturningAfterSetback` -- un segundo intento real tras un desenlace que no fue positivo, nunca tratado como si empezara de cero (Principio 7). */
  "welcome_back",
  /** `arc.echo` presente -- un capítulo pasado de este mismo arco cae en la fecha de hoy (Principio 8: "time itself is evidence"). */
  "echo",
  /** Retomar una historia abierta/en desarrollo tal cual, sin urgencia especial. */
  "resume",
  /** Volver a mirar algo cuyo momento programado ya llegó. */
  "check_in",
  /** Reconocer un desenlace positivo real. */
  "celebrate",
  /** Mirar atrás algo que cerró hace poco. */
  "reflect",
  /** Anticipar algo próximo y ya fechado (reunión, vencimiento, aniversario). */
  "prepare",
  /** Reconocer honestamente que un asunto se está apagando sin evidencia nueva -- nunca cerrarlo, solo nombrarlo. */
  "release",
] as const;

export type NarrativeContinuationKind = (typeof NARRATIVE_CONTINUATION_KINDS)[number];

/**
 * `title`/`summary` son passthrough exacto de
 * `currentActiveStory.current.title`/`.summary` -- nunca texto nuevo. Un
 * futuro consumidor con capacidad real de redactar (Morning Brief,
 * Conversation Strategy) es quien convierte `kind` + estos datos reales
 * en una frase; este módulo nunca lo hace por su cuenta.
 */
export interface NarrativeContinuation {
  readonly arcKey: string;
  readonly threadId: string;
  readonly kind: NarrativeContinuationKind;
  readonly reason: NarrativeReason;
  readonly title: string;
  readonly summary: string;
  /** Presente únicamente cuando `kind === "echo"`. */
  readonly echo?: NarrativeEcho;
}
