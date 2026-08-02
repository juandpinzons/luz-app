import type { NarrativeArc } from "../domain/narrative-arc";
import type { NarrativePriority } from "../domain/narrative-priority";

export interface NarrativePresenceSignal {
  readonly threadId: string;
  readonly title: string;
  readonly priority: NarrativePriority;
  /** Passthrough de `NarrativeArc.isReturningAfterSetback` -- señal real de que esto es un segundo intento, no un asunto nuevo (Principio 7). */
  readonly isReturningAfterSetback: boolean;
  /** `true` cuando `NarrativeArc.echo` está presente -- señal real de que hoy coincide con la fecha de un capítulo pasado (Principio 8). */
  readonly hasEcho: boolean;
}

/**
 * `NarrativeState.currentActiveStory` -> señal de continuidad para la
 * Capa de Presencia -- misión: "It becomes the deterministic input
 * consumed later by Presence and Conversation." `null` cuando no hay
 * historia activa. Ningún llamador real hoy (cero import cruzado desde
 * `features/presence/`, verificado) -- mismo criterio que
 * `toPresenceSignals` (`features/continuity/integrations/`): contrato
 * listo, sin wiring todavía.
 */
export function toPresenceContinuitySignal(currentActiveStory: NarrativeArc | null): NarrativePresenceSignal | null {
  if (!currentActiveStory) return null;
  return {
    threadId: currentActiveStory.current.id,
    title: currentActiveStory.current.title,
    priority: currentActiveStory.priority,
    isReturningAfterSetback: currentActiveStory.isReturningAfterSetback,
    hasEcho: currentActiveStory.echo !== null,
  };
}
