import type { ConversationRule } from "./conversation-rule";
import { PrioritizeUnderstandingRule } from "./prioritize-understanding-rule";
import { AvoidUnnecessaryQuestionsRule } from "./avoid-unnecessary-questions-rule";
import { FavorContinuityRule } from "./favor-continuity-rule";
import { AvoidRepeatingKnownInfoRule } from "./avoid-repeating-known-info-rule";
import { FavorBrevityRule } from "./favor-brevity-rule";

export type { ConversationRule, ConversationRuleInput } from "./conversation-rule";
export { PrioritizeUnderstandingRule } from "./prioritize-understanding-rule";
export { AvoidUnnecessaryQuestionsRule } from "./avoid-unnecessary-questions-rule";
export { FavorContinuityRule } from "./favor-continuity-rule";
export { AvoidRepeatingKnownInfoRule } from "./avoid-repeating-known-info-rule";
export { FavorBrevityRule } from "./favor-brevity-rule";

/**
 * Registro de reglas activas — mismo patrón que `auth/providers/index.ts`:
 * agregar una regla nueva es agregarla aquí, nunca tocar el Context
 * Builder ni las demás reglas.
 */
export const CONVERSATION_RULES: readonly ConversationRule[] = [
  new PrioritizeUnderstandingRule(),
  new AvoidUnnecessaryQuestionsRule(),
  new FavorContinuityRule(),
  new AvoidRepeatingKnownInfoRule(),
  new FavorBrevityRule(),
];
