import type {
  ConversationRule,
  ConversationRuleInput,
} from "./conversation-rule";

/**
 * `docs/product/CONVERSATION_MANUAL_V1.md`, "Seguimiento": "LUZ no
 * olvida el tiempo. Las conversaciones continúan." Solo aplica cuando
 * hay memoria relevante — sin eso, no hay nada con lo que dar
 * continuidad, y forzar la instrucción de todas formas ensuciaría el
 * prompt sin propósito (mismo criterio que ya usaba
 * `toSystemMessage` en Sprint B2, ahora expresado como regla propia).
 */
export class FavorContinuityRule implements ConversationRule {
  readonly id = "favor-continuity";

  applies(input: ConversationRuleInput): boolean {
    return input.memories.length > 0;
  }

  directive(input: ConversationRuleInput): string {
    const memoryLines = input.memories
      .map((item) => `- ${item.content}`)
      .join("\n");

    return `Ya existe memoria relevante de esta persona:\n${memoryLines}\nDa continuidad a partir de ahí — no trates este mensaje como si fuera la primera vez que hablan.`;
  }
}
