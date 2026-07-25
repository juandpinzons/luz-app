import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";
import type {
  ConversationStrategyRule,
  ConversationStrategyRuleInput,
} from "./conversation-strategy-rule";

/**
 * El piso de todo el conjunto — la única regla incondicional
 * (`appliesTo` siempre `true`), con la prioridad más baja. Garantiza
 * que `DefaultConversationStrategyEngine.select()` siempre tenga una
 * estrategia que devolver, incluso sin ninguna señal estructural
 * (primer contacto, o una conversación en curso sin nada que otra
 * regla haya reconocido). Sin esta regla, "ninguna estrategia aplicó"
 * sería un estado real y habría que decidir qué hacer con él — con
 * ella, ese estado nunca ocurre.
 */
export class ListenStrategyRule implements ConversationStrategyRule {
  readonly id: ConversationStrategyType = "listen";
  readonly priority = 5;

  appliesTo(_input: ConversationStrategyRuleInput): boolean {
    return true;
  }

  explain(input: ConversationStrategyRuleInput): ConversationStrategyDirective {
    return {
      strategy: this.id,
      reason: input.isFirstContact
        ? "Es el primer mensaje real de esta conversación — todavía no hay contexto acumulado sobre esta persona."
        : "Ninguna señal estructural domina ahora mismo — ni un patrón, ni un riesgo, ni una fecha próxima, ni algo pendiente de retomar.",
      primaryObjective: "Entender antes que resolver — dejar que la persona guíe de qué se trata este momento.",
      avoid: "Ofrecer soluciones o interpretaciones antes de entender qué está pasando de verdad.",
    };
  }
}
