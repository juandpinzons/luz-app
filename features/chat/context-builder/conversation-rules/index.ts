import type { ConversationRule } from "./conversation-rule";
import { PrioritizeUnderstandingRule } from "./prioritize-understanding-rule";
import { FavorPrioritizedContextRule } from "./favor-prioritized-context-rule";
import { AvoidRepeatingKnownInfoRule } from "./avoid-repeating-known-info-rule";
import { FrameReconnectionRule } from "./frame-reconnection-rule";
import { AvoidTopicMonotonyRule } from "./avoid-topic-monotony-rule";

export type { ConversationRule, ConversationRuleInput } from "./conversation-rule";
export { PrioritizeUnderstandingRule } from "./prioritize-understanding-rule";
export { FavorPrioritizedContextRule } from "./favor-prioritized-context-rule";
export { AvoidRepeatingKnownInfoRule } from "./avoid-repeating-known-info-rule";
export { FrameReconnectionRule } from "./frame-reconnection-rule";
export { AvoidTopicMonotonyRule } from "./avoid-topic-monotony-rule";

/**
 * Registro de reglas activas — mismo patrón que `auth/providers/index.ts`:
 * agregar una regla nueva es agregarla aquí, nunca tocar el Context
 * Builder ni las demás reglas.
 *
 * Solo reglas de CONTENIDO — qué debe tener presente el modelo
 * (comprensión antes de resolver, contexto priorizado, no repetir lo ya
 * sabido). Las reglas de ESTILO (`AvoidParaphrasingRule`,
 * `AvoidUnnecessaryQuestionsRule`, `FavorBrevityRule`) se retiraron de
 * aquí cuando `core/voice-engine` se conectó al pipeline real (Fase
 * II): ese es ahora el único lugar que decide cómo debe sonar una
 * respuesta — ver `BASE_FORBID` en `core/voice-engine/engine/default-voice-engine.ts`.
 */
export const CONVERSATION_RULES: readonly ConversationRule[] = [
  new PrioritizeUnderstandingRule(),
  new FavorPrioritizedContextRule(),
  new AvoidRepeatingKnownInfoRule(),
  new FrameReconnectionRule(),
  new AvoidTopicMonotonyRule(),
];
