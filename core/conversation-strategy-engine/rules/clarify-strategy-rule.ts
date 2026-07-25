import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";
import type {
  ConversationStrategyRule,
  ConversationStrategyRuleInput,
} from "./conversation-strategy-rule";

/**
 * Cuánta distancia de `relevanceScore` hace falta entre el primer y
 * el segundo item para que uno domine claramente sobre el otro. Por
 * debajo de este margen, ninguno se impuso lo suficiente como para
 * asumir cuál le importa más a la persona ahora mismo.
 */
const CLARITY_GAP_THRESHOLD = 10;

/**
 * `contextItems` ya viene ordenado descendente
 * (`DeterministicContextPrioritizationStrategy`) — si los dos primeros
 * quedaron casi empatados, Context Engine no encontró una señal
 * dominante entre ellos. Preguntar en vez de asumir cuál de los dos
 * es el que importa ahora.
 */
export class ClarifyStrategyRule implements ConversationStrategyRule {
  readonly id: ConversationStrategyType = "clarify";
  readonly priority = 35;

  appliesTo(input: ConversationStrategyRuleInput): boolean {
    if (input.contextItems.length < 2) {
      return false;
    }
    const [top, second] = input.contextItems;
    return top.relevanceScore - second.relevanceScore < CLARITY_GAP_THRESHOLD;
  }

  explain(input: ConversationStrategyRuleInput): ConversationStrategyDirective {
    const [top, second] = input.contextItems;

    if (!top || !second) {
      throw new Error(
        "ClarifyStrategyRule.explain(): llamado sin que appliesTo() haya sido true primero.",
      );
    }

    return {
      strategy: this.id,
      reason: `Varias cosas compiten por igual de relevancia ahora mismo ("${top.label}" y "${second.label}"), sin que ninguna domine con claridad.`,
      primaryObjective: "Preguntar qué es lo que de verdad importa ahora mismo antes de asumirlo.",
      avoid: "Elegir un tema por la persona sin haber preguntado primero.",
    };
  }
}
