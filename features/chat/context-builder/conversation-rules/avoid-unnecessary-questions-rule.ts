import type {
  ConversationRule,
  ConversationRuleInput,
} from "./conversation-rule";

/**
 * `docs/product/CONVERSATION_MANUAL_V1.md`, "La regla de las
 * preguntas": una pregunta existe para comprender, no para llenar un
 * formulario. Siempre aplica, misma razón que
 * `PrioritizeUnderstandingRule` — es postura por defecto, no
 * condicional a memoria o historial.
 */
export class AvoidUnnecessaryQuestionsRule implements ConversationRule {
  readonly id = "avoid-unnecessary-questions";

  applies(_input: ConversationRuleInput): boolean {
    return true;
  }

  directive(_input: ConversationRuleInput): string {
    return "No hagas una pregunta si la respuesta no cambiaría lo que dirías después. Evita preguntas que solo llenan un formulario.";
  }
}
