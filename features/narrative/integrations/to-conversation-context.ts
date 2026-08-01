import type { NarrativeContinuation } from "../domain/narrative-continuation";
import type { NarrativeProgression } from "../domain/narrative-progression";
import type { NarrativeState } from "../domain/narrative-state";

export interface NarrativeConversationContext {
  readonly activeArcKey: string | null;
  readonly activeThreadId: string | null;
  readonly activeChapter: NarrativeProgression | null;
  readonly isReturningAfterSetback: boolean;
  readonly hasEcho: boolean;
  readonly continuation: NarrativeContinuation | null;
  readonly openThreadCount: number;
  readonly recurringArcCount: number;
}

/**
 * Datos crudos para que un futuro Conversation Strategy sepa "seguimos a
 * mitad de una historia sobre X, capítulo Y -- y esto ya pasó antes" --
 * misión: "It becomes the deterministic input consumed later by
 * Presence and Conversation." Nunca una frase, nunca una decisión de
 * qué decir -- eso sigue siendo responsabilidad exclusiva de un
 * consumidor con capacidad real de redactar
 * (`core/conversation-strategy-engine`), nunca de este módulo. Ningún
 * llamador real hoy.
 */
export function toConversationContext(state: NarrativeState): NarrativeConversationContext {
  return {
    activeArcKey: state.currentActiveStory?.key ?? null,
    activeThreadId: state.currentActiveStory?.current.id ?? null,
    activeChapter: state.currentActiveStory?.current.chapter.stage ?? null,
    isReturningAfterSetback: state.currentActiveStory?.isReturningAfterSetback ?? false,
    hasEcho: Boolean(state.currentActiveStory?.echo),
    continuation: state.continuation,
    openThreadCount: state.openStories.length,
    recurringArcCount: state.recurringArcs.length,
  };
}
