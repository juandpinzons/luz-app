import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";
import { hoursBetween, prioritizedMemories } from "./context-item-helpers";
import type {
  ConversationStrategyRule,
  ConversationStrategyRuleInput,
} from "./conversation-strategy-rule";

/** A partir de cuántas horas una memoria deja de sentirse "recién pasó". */
const FRESH_MEMORY_HOURS = 48;

function topFreshMemory(input: ConversationStrategyRuleInput) {
  const top = input.contextItems[0];
  if (!top || top.source !== "memory") {
    return undefined;
  }
  const memory = prioritizedMemories(input).find((item) => item.id === top.sourceId);
  if (!memory?.occurredAt) {
    return undefined;
  }
  return hoursBetween(memory.occurredAt, new Date()) <= FRESH_MEMORY_HOURS ? memory : undefined;
}

/**
 * Lo más relevante ahora mismo (`contextItems[0]`, ya ordenado por
 * `DeterministicContextPrioritizationStrategy`) es una memoria muy
 * reciente y nada por encima de ella (ningún riesgo, ningún patrón de
 * postergación, ninguna fecha próxima — de haberlos, ya habrían
 * ganado por prioridad más alta antes de llegar aquí). El momento para
 * reconocer algo, no para resolver nada.
 */
export class CelebrateStrategyRule implements ConversationStrategyRule {
  readonly id: ConversationStrategyType = "celebrate";
  readonly priority = 45;

  appliesTo(input: ConversationStrategyRuleInput): boolean {
    return Boolean(topFreshMemory(input));
  }

  explain(input: ConversationStrategyRuleInput): ConversationStrategyDirective {
    const memory = topFreshMemory(input);

    if (!memory) {
      throw new Error(
        "CelebrateStrategyRule.explain(): llamado sin que appliesTo() haya sido true primero.",
      );
    }

    return {
      strategy: this.id,
      reason: `Lo más relevante ahora mismo es reciente y nada urgente compite por la atención: "${memory.content}".`,
      primaryObjective: "Reconocer y afirmar lo que acaba de pasar antes de avanzar a cualquier otra cosa.",
      avoid: "Minimizar el momento pasando rápido a la siguiente pregunta o tarea.",
    };
  }
}
