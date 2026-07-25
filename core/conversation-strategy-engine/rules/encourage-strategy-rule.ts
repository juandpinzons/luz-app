import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";
import { prioritizedInsights } from "./context-item-helpers";
import type {
  ConversationStrategyRule,
  ConversationStrategyRuleInput,
} from "./conversation-strategy-rule";

/** Coincide con `INSIGHT_TYPES` (`core/knowledge-engine/value-objects/insight-type.ts`). */
const RISK_INSIGHT_TYPE = "risk";

/**
 * Un riesgo real ya identificado (p. ej. aislamiento, agotamiento)
 * pesa más que cualquier otra postura excepto un patrón de
 * postergación ya confrontable (`ChallengeStrategyRule`, prioridad
 * mayor) — sostener a la persona alrededor de algo concreto que
 * Knowledge Engine ya nombró, no un ánimo genérico sin base.
 */
export class EncourageStrategyRule implements ConversationStrategyRule {
  readonly id: ConversationStrategyType = "encourage";
  readonly priority = 85;

  appliesTo(input: ConversationStrategyRuleInput): boolean {
    return prioritizedInsights(input).some((insight) => insight.type === RISK_INSIGHT_TYPE);
  }

  explain(input: ConversationStrategyRuleInput): ConversationStrategyDirective {
    const riskInsight = prioritizedInsights(input).find(
      (insight) => insight.type === RISK_INSIGHT_TYPE,
    );

    if (!riskInsight) {
      throw new Error(
        "EncourageStrategyRule.explain(): llamado sin que appliesTo() haya sido true primero.",
      );
    }

    return {
      strategy: this.id,
      reason: `Se identificó un riesgo real sobre esta persona: "${riskInsight.description}".`,
      primaryObjective: "Sostener y dar ánimo sin minimizar el riesgo identificado — que la persona sienta apoyo concreto, no un discurso genérico de optimismo.",
      avoid: "Ignorar el riesgo identificado o saltar a resolverlo antes de sostener a la persona.",
    };
  }
}
