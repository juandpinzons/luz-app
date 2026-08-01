import type { NarrativePriority } from "../domain/narrative-priority";
import type { NarrativeThread } from "../domain/narrative-thread";

export interface NarrativePresenceSignal {
  readonly threadId: string;
  readonly title: string;
  readonly priority: NarrativePriority;
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
export function toPresenceContinuitySignal(currentActiveStory: NarrativeThread | null): NarrativePresenceSignal | null {
  if (!currentActiveStory) return null;
  return { threadId: currentActiveStory.id, title: currentActiveStory.title, priority: currentActiveStory.priority };
}
