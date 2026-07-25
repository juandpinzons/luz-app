import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";
import { daysUntil, prioritizedInsights, prioritizedLifeItems } from "./context-item-helpers";
import type {
  ConversationStrategyRule,
  ConversationStrategyRuleInput,
} from "./conversation-strategy-rule";

/** Coincide con `INSIGHT_TYPES` (`core/knowledge-engine/value-objects/insight-type.ts`). */
const RECOMMENDATION_INSIGHT_TYPE = "recommendation";

/** A partir de cuántos días de anticipación un `dueDate` deja de considerarse "inminente". Mismo `URGENCY_WINDOW_DAYS` que ya usa `DeterministicContextScoringStrategy` para subir el score de un goal/project, recortado a la mitad: aquí no se trata de si el item merece atención (eso ya se decidió), sino de si hace falta un plan concreto ahora mismo. */
const IMMINENT_DEADLINE_DAYS = 14;

function imminentLifeItem(input: ConversationStrategyRuleInput) {
  const now = new Date();
  return prioritizedLifeItems(input)
    .filter((item) => item.dueDate && daysUntil(item.dueDate, now) <= IMMINENT_DEADLINE_DAYS)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())[0];
}

/**
 * Dos señales distintas que ambas piden lo mismo — un siguiente paso
 * concreto, no más reflexión: una recomendación que Knowledge Engine
 * ya generó, o un goal/project activo cuyo `dueDate` ya está cerca.
 * Ninguna de las dos implica un riesgo o un patrón de evitación —
 * de haberlo, `EncourageStrategyRule`/`ChallengeStrategyRule` (mayor
 * prioridad) ya lo habrían capturado antes de llegar aquí.
 */
export class PlanStrategyRule implements ConversationStrategyRule {
  readonly id: ConversationStrategyType = "plan";
  readonly priority = 75;

  appliesTo(input: ConversationStrategyRuleInput): boolean {
    const hasRecommendation = prioritizedInsights(input).some(
      (insight) => insight.type === RECOMMENDATION_INSIGHT_TYPE,
    );
    return hasRecommendation || Boolean(imminentLifeItem(input));
  }

  explain(input: ConversationStrategyRuleInput): ConversationStrategyDirective {
    const recommendation = prioritizedInsights(input).find(
      (insight) => insight.type === RECOMMENDATION_INSIGHT_TYPE,
    );
    const imminentItem = imminentLifeItem(input);

    if (!recommendation && !imminentItem) {
      throw new Error(
        "PlanStrategyRule.explain(): llamado sin que appliesTo() haya sido true primero.",
      );
    }

    const reason = recommendation
      ? `Knowledge Engine ya recomienda algo concreto sobre esta persona: "${recommendation.description}".`
      : `"${imminentItem!.label}" vence pronto (en ${Math.max(0, Math.ceil(daysUntil(imminentItem!.dueDate!, new Date())))} día(s)).`;

    return {
      strategy: this.id,
      reason,
      primaryObjective: "Ayudar a definir el siguiente paso concreto y accionable, con tiempo real para ejecutarlo.",
      avoid: "Quedarse en la reflexión abstracta cuando lo que hace falta es un plan concreto.",
    };
  }
}
