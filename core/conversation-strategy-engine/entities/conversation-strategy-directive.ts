import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";

/**
 * La decisión completa que `ConversationStrategyEngine.select()`
 * entrega — nunca solo el nombre de la estrategia. El modelo recibe
 * una intención explicada, no una etiqueta suelta que tendría que
 * reinterpretar por su cuenta (justo lo que este sprint existe para
 * evitar).
 *
 * Las cuatro partes son siempre texto derivado de los datos reales que
 * activaron la regla (el título del goal, la descripción del insight,
 * los días de distancia...) — nunca una plantilla estática repetida
 * sin importar el contexto; cada `ConversationStrategyRule.explain()`
 * interpola sus propios datos aquí.
 */
export interface ConversationStrategyDirective {
  strategy: ConversationStrategyType;
  /** Por qué esta estrategia, en términos de lo que de verdad se observó. */
  reason: string;
  /** Qué debería lograr esta respuesta puntual, no la conversación entera. */
  primaryObjective: string;
  /** Qué comportamiento evitar específicamente en esta postura. */
  avoid: string;
}
