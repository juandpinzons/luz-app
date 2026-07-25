import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyRuleInput } from "../rules/conversation-strategy-rule";

/**
 * Único punto de acceso al Conversation Strategy Engine que vería el
 * resto del dominio — mismo patrón que `ContextEngine`
 * (`core/context-engine`), `MemoryEngine` y `KnowledgeEngine`.
 * Contrato únicamente: sin implementación. Sincrónico a propósito,
 * distinto de esos tres — nunca toca la base de datos, solo consume
 * lo que `ConversationStrategyRuleInput` ya trae calculado (mismo
 * criterio que `ConversationRule.applies()`/`.directive()`,
 * `features/chat/context-builder`, su vecino más cercano en el
 * pipeline).
 */
export interface ConversationStrategyEngine {
  select(input: ConversationStrategyRuleInput): ConversationStrategyDirective;
}
