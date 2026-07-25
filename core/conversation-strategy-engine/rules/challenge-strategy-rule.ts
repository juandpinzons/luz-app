import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";
import { prioritizedInsights, prioritizedLifeItems } from "./context-item-helpers";
import type {
  ConversationStrategyRule,
  ConversationStrategyRuleInput,
} from "./conversation-strategy-rule";

/** Coincide con `INSIGHT_TYPES` (`core/knowledge-engine/value-objects/insight-type.ts`) — mismo criterio que `RealityInsightItem.type: string` para no importar el value object del engine dentro de este cruce. */
const PATTERN_INSIGHT_TYPE = "pattern";

/**
 * La más alta prioridad del conjunto: un patrón de comportamiento ya
 * identificado por Knowledge Engine (p. ej. postergar una decisión una
 * y otra vez) sobre algo que sigue activo en Life State no es una
 * señal para acompañar con más suavidad — es la señal para confrontar
 * con algo concreto. Exactamente el ejemplo del sprint: "User has
 * postponed the same high-priority goal multiple times."
 */
export class ChallengeStrategyRule implements ConversationStrategyRule {
  readonly id: ConversationStrategyType = "challenge";
  readonly priority = 95;

  appliesTo(input: ConversationStrategyRuleInput): boolean {
    const hasPattern = prioritizedInsights(input).some(
      (insight) => insight.type === PATTERN_INSIGHT_TYPE,
    );
    return hasPattern && prioritizedLifeItems(input).length > 0;
  }

  explain(input: ConversationStrategyRuleInput): ConversationStrategyDirective {
    const patternInsight = prioritizedInsights(input).find(
      (insight) => insight.type === PATTERN_INSIGHT_TYPE,
    );
    const lifeItem = prioritizedLifeItems(input)[0];

    if (!patternInsight || !lifeItem) {
      throw new Error(
        "ChallengeStrategyRule.explain(): llamado sin que appliesTo() haya sido true primero.",
      );
    }

    return {
      strategy: this.id,
      reason: `Patrón ya identificado sobre esta persona: "${patternInsight.description}" — y "${lifeItem.label}" sigue activo, sin resolver.`,
      primaryObjective: `Ayudarla a comprometerse con una acción concreta y específica sobre "${lifeItem.label}" — no otra reflexión general sobre el tema.`,
      avoid: "Repetir consejos que ya se le han dado antes, o suavizar el punto hasta que pierda su fuerza.",
    };
  }
}
