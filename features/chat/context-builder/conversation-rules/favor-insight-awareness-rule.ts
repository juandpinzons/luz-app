import type {
  ConversationRule,
  ConversationRuleInput,
} from "./conversation-rule";

/**
 * Distinta de `FavorContinuityRule`: esa da continuidad a partir de
 * UNA memoria puntual ("qué pasó"); esta da continuidad a partir de
 * algo que el Knowledge Engine ya interpretó de varias memorias
 * relacionadas ("qué significa") -- conocimiento a través del tiempo,
 * no de un solo mensaje (2026-07-25,
 * docs/engineering/FIRST_MESSAGE_IDENTITY_PLAN.md).
 *
 * La instrucción pide explícitamente NUNCA recitarlo como una lista o
 * un dato suelto -- el riesgo real identificado en ese plan es que
 * esto se sienta como "leer un perfil" en vez de que la respuesta
 * simplemente suene como de alguien que ya entiende a la persona.
 */
export class FavorInsightAwarenessRule implements ConversationRule {
  readonly id = "favor-insight-awareness";

  applies(input: ConversationRuleInput): boolean {
    return input.insights.length > 0;
  }

  directive(input: ConversationRuleInput): string {
    const insightLines = input.insights
      .map((item) => `- ${item.description}`)
      .join("\n");

    return `Ya entendiste algo más profundo sobre esta persona a partir de varias conversaciones, no solo esta:\n${insightLines}\nDéjalo influir en cómo respondes, de forma natural — nunca lo repitas como una lista ni lo anuncies como un dato que "descubriste". Solo si de verdad ayuda a esta respuesta puntual.`;
  }
}
