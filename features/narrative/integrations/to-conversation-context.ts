import type { NarrativeContinuation } from "../domain/narrative-continuation";
import type { NarrativeProgression } from "../domain/narrative-progression";
import type { NarrativeState } from "../domain/narrative-state";

export interface NarrativeConversationContext {
  readonly activeThreadId: string | null;
  readonly activeChapter: NarrativeProgression | null;
  readonly continuation: NarrativeContinuation | null;
  readonly openThreadCount: number;
}

/**
 * Datos crudos para que un futuro Conversation Strategy sepa "seguimos a
 * mitad de una historia sobre X, capítulo Y" -- misión: "It becomes the
 * deterministic input consumed later by Presence and Conversation."
 * Nunca una frase, nunca una decisión de qué decir -- eso sigue siendo
 * responsabilidad exclusiva de un consumidor con capacidad real de
 * redactar (`core/conversation-strategy-engine`), nunca de este módulo.
 * Ningún llamador real hoy.
 */
export function toConversationContext(state: NarrativeState): NarrativeConversationContext {
  return {
    activeThreadId: state.currentActiveStory?.id ?? null,
    activeChapter: state.currentActiveStory?.chapter.stage ?? null,
    continuation: state.continuation,
    openThreadCount: state.openStories.length,
  };
}
