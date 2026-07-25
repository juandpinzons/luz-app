import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import { CONVERSATION_STRATEGY_RULES } from "../rules";
import type {
  ConversationStrategyRule,
  ConversationStrategyRuleInput,
} from "../rules/conversation-strategy-rule";
import type { ConversationStrategyEngine } from "./conversation-strategy-engine";

/**
 * Evalúa las reglas en orden de `priority` descendente y devuelve la
 * primera que aplica — mismo criterio de "primera que aplica gana" que
 * usa `determineResponseIntent` (`features/chat/context-builder`) para
 * sus tres casos, ahora generalizado a ocho con prioridad explícita en
 * vez de un `if`/`else` encadenado a mano. Ninguna regla necesita
 * saber de las demás: el orden de evaluación es responsabilidad
 * exclusiva de este engine, nunca de las reglas entre sí.
 */
export class DefaultConversationStrategyEngine implements ConversationStrategyEngine {
  private readonly rulesByPriorityDesc: readonly ConversationStrategyRule[];

  constructor(rules: readonly ConversationStrategyRule[]) {
    this.rulesByPriorityDesc = [...rules].sort((a, b) => b.priority - a.priority);
  }

  select(input: ConversationStrategyRuleInput): ConversationStrategyDirective {
    const matched = this.rulesByPriorityDesc.find((rule) => rule.appliesTo(input));

    // `ListenStrategyRule.appliesTo()` siempre devuelve `true` — este
    // punto es estructuralmente inalcanzable mientras esa regla siga
    // registrada. Falla fuerte en vez de devolver un valor por
    // defecto silencioso si alguna vez deja de estarlo, mismo
    // criterio que "la ausencia real se representa como ausencia" en
    // vez de rellenar con algo que parezca válido sin serlo.
    if (!matched) {
      throw new Error(
        "ConversationStrategyEngine.select(): ninguna regla aplicó — ListenStrategyRule debe seguir registrada como catch-all incondicional.",
      );
    }

    return matched.explain(input);
  }
}

export function createConversationStrategyEngine(): ConversationStrategyEngine {
  return new DefaultConversationStrategyEngine(CONVERSATION_STRATEGY_RULES);
}
