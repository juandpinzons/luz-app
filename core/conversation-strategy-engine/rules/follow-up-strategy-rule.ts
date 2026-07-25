import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";
import { daysBetween, prioritizedMemories } from "./context-item-helpers";
import type {
  ConversationStrategyRule,
  ConversationStrategyRuleInput,
} from "./conversation-strategy-rule";

/** A partir de cuántos días una memoria relevante deja de sentirse "reciente" y empieza a merecer que alguien retome el hilo, no solo que se le dé continuidad implícita. */
const STALE_MEMORY_DAYS = 3;

function mostRecentPrioritizedMemory(input: ConversationStrategyRuleInput) {
  return prioritizedMemories(input)
    .filter((memory) => memory.occurredAt)
    .sort((a, b) => b.occurredAt!.getTime() - a.occurredAt!.getTime())[0];
}

/**
 * Hay memoria relevante, pero ya se enfrió — lo último que se sabe de
 * esta persona no es de ahora mismo. Requiere que no sea el primer
 * contacto (`isFirstContact`): sin turnos previos, "retomar un hilo"
 * no aplica todavía, eso es `ListenStrategyRule`.
 */
export class FollowUpStrategyRule implements ConversationStrategyRule {
  readonly id: ConversationStrategyType = "follow_up";
  readonly priority = 55;

  appliesTo(input: ConversationStrategyRuleInput): boolean {
    if (input.isFirstContact) {
      return false;
    }
    const mostRecent = mostRecentPrioritizedMemory(input);
    if (!mostRecent?.occurredAt) {
      return false;
    }
    return daysBetween(mostRecent.occurredAt, new Date()) > STALE_MEMORY_DAYS;
  }

  explain(input: ConversationStrategyRuleInput): ConversationStrategyDirective {
    const mostRecent = mostRecentPrioritizedMemory(input);

    if (!mostRecent?.occurredAt) {
      throw new Error(
        "FollowUpStrategyRule.explain(): llamado sin que appliesTo() haya sido true primero.",
      );
    }

    const days = Math.floor(daysBetween(mostRecent.occurredAt, new Date()));

    return {
      strategy: this.id,
      reason: `Lo último relevante fue hace ${days} día(s): "${mostRecent.content}".`,
      primaryObjective: "Retomar ese hilo y preguntar cómo ha evolucionado, sin asumir que sigue exactamente igual.",
      avoid: "Actuar como si la conversación nunca se hubiera pausado.",
    };
  }
}
