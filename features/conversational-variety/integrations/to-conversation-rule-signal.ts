import type { ConversationCategory } from "../../../core/db/schema/conversations";
import type { ConversationVarietySnapshot } from "../domain/conversation-variety-snapshot";

/**
 * Datos crudos únicamente -- nunca una frase, nunca una decisión de
 * qué decir, mismo límite que `IdentityConversationSignal`/
 * `NarrativeConversationContext`. `AvoidTopicMonotonyRule`
 * (`features/chat/context-builder/conversation-rules/`) es su único
 * consumidor real.
 */
export interface ConversationVarietyRuleSignal {
  readonly isMonotonous: boolean;
  readonly dominantDomain: ConversationCategory | null;
  readonly dominantDomainShare: number;
  readonly dominantDomainStreak: number;
  readonly windowSize: number;
}

export function toConversationVarietyRuleSignal(
  snapshot: ConversationVarietySnapshot,
): ConversationVarietyRuleSignal {
  return {
    isMonotonous: snapshot.isMonotonous,
    dominantDomain: snapshot.dominantDomain?.domain ?? null,
    dominantDomainShare: snapshot.dominantDomain?.shareOfWindow ?? 0,
    dominantDomainStreak: snapshot.dominantDomainStreak,
    windowSize: snapshot.windowSize,
  };
}
