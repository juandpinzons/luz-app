import type {
  ConversationRule,
  ConversationRuleInput,
} from "./conversation-rule";

/**
 * `docs/product/CONVERSATION_MANUAL_V1.md`, "Escuchar antes de
 * resolver" y "El orden correcto" (presente → emoción → contexto →
 * necesidad → objetivo → acción). Siempre aplica — no depende de
 * memoria ni de historial, es la postura por defecto de toda
 * respuesta.
 */
export class PrioritizeUnderstandingRule implements ConversationRule {
  readonly id = "prioritize-understanding";

  applies(_input: ConversationRuleInput): boolean {
    return true;
  }

  directive(_input: ConversationRuleInput): string {
    return "Prioriza comprender la situación antes de ofrecer una recomendación o solución. Si algo no está claro, pregúntalo antes de resolver.";
  }
}
