import type {
  ConversationRule,
  ConversationRuleInput,
} from "./conversation-rule";

/**
 * `docs/product/CONVERSATION_MANUAL_V1.md`, "El objetivo real" ("La
 * utilidad siempre tiene prioridad sobre la longitud"), "El silencio"
 * ("Después de una confesión importante, una respuesta breve suele ser
 * mejor que una explicación larga") y "Qué evita LUZ" ("hablar
 * demasiado", "responder con listas innecesarias"). Siempre aplica —
 * es la postura por defecto, igual que PrioritizeUnderstandingRule.
 *
 * Encontrada como gap real (Alpha, día 2 de pilotaje): sin esta regla,
 * el modelo respondía a mensajes emocionalmente cargados con ensayos
 * estructurados de varias secciones — contradice el manual y además
 * es la causa medida de la lentitud percibida (más texto generado, más
 * tiempo de respuesta).
 */
export class FavorBrevityRule implements ConversationRule {
  readonly id = "favor-brevity";

  applies(_input: ConversationRuleInput): boolean {
    return true;
  }

  directive(_input: ConversationRuleInput): string {
    return "Prefiere respuestas breves, precisas y conversacionales, como lo haría una persona presente. La estructura larga (títulos, secciones, listas) no está prohibida —úsala solo cuando la situación realmente la necesite (por ejemplo, un plan de pasos concretos que la persona pidió), nunca por defecto. Ante la duda, más corto suele ser mejor, sobre todo justo después de algo emocionalmente importante.";
  }
}
