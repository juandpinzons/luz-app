import type { ConversationStrategyRule } from "./conversation-strategy-rule";
import { ChallengeStrategyRule } from "./challenge-strategy-rule";
import { EncourageStrategyRule } from "./encourage-strategy-rule";
import { PlanStrategyRule } from "./plan-strategy-rule";
import { RemindStrategyRule } from "./remind-strategy-rule";
import { FollowUpStrategyRule } from "./follow-up-strategy-rule";
import { CelebrateStrategyRule } from "./celebrate-strategy-rule";
import { CuriosityStrategyRule } from "./curiosity-strategy-rule";
import { ReflectStrategyRule } from "./reflect-strategy-rule";
import { ClarifyStrategyRule } from "./clarify-strategy-rule";
import { ListenStrategyRule } from "./listen-strategy-rule";

export type { ConversationStrategyRule, ConversationStrategyRuleInput } from "./conversation-strategy-rule";
export { ChallengeStrategyRule } from "./challenge-strategy-rule";
export { EncourageStrategyRule } from "./encourage-strategy-rule";
export { PlanStrategyRule } from "./plan-strategy-rule";
export { RemindStrategyRule } from "./remind-strategy-rule";
export { FollowUpStrategyRule } from "./follow-up-strategy-rule";
export { CelebrateStrategyRule } from "./celebrate-strategy-rule";
export { CuriosityStrategyRule } from "./curiosity-strategy-rule";
export { ReflectStrategyRule } from "./reflect-strategy-rule";
export { ClarifyStrategyRule } from "./clarify-strategy-rule";
export { ListenStrategyRule } from "./listen-strategy-rule";

/**
 * Registro de reglas activas, en el orden en que se declaran aquí —
 * mismo patrón que `CONVERSATION_RULES`
 * (`features/chat/context-builder/conversation-rules`): agregar una
 * estrategia nueva es un archivo nuevo más una línea aquí, nunca tocar
 * el engine ni las demás reglas. El orden de esta lista no importa
 * para la selección (`DefaultConversationStrategyEngine` ordena por
 * `priority`), pero sí importa como lectura: de la más específica a la
 * más genérica.
 */
export const CONVERSATION_STRATEGY_RULES: readonly ConversationStrategyRule[] = [
  new ChallengeStrategyRule(),
  new EncourageStrategyRule(),
  new PlanStrategyRule(),
  new RemindStrategyRule(),
  new FollowUpStrategyRule(),
  new CelebrateStrategyRule(),
  new CuriosityStrategyRule(),
  new ReflectStrategyRule(),
  new ClarifyStrategyRule(),
  new ListenStrategyRule(),
];
