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
 *
 * Reforzada (2026-07-19): con más reglas activas al mismo tiempo
 * (continuidad, no-repetición, etc.), la versión original ("prefiere
 * breve") se diluía — validado con IA real: 660 caracteres con la
 * redacción suave, 224 con esta. El límite numérico explícito importa
 * más que la intención expresada en prosa.
 *
 * Reforzada de nuevo (día 3 de pilotaje, chequeo diario de producción):
 * bug real encontrado en datos reales, no en pruebas — Oscar (83 años,
 * el usuario con menor literacidad digital del pilotaje) preguntó "Cómo
 * podría ayudarme" y recibió una respuesta de 734 caracteres con una
 * lista de 4 viñetas, violando el límite duro. Reproducido con la
 * misma conversación real contra IA real: el modelo no viola la regla
 * siempre (0/3 intentos en la reproducción), así que no es un bug de
 * cableado — es que preguntas de "qué puedes hacer"/"cómo me ayudas"
 * empujan al modelo hacia enumerar capacidades como una lista, y a
 * veces gana esa tentación sobre el límite. Se agrega una cláusula
 * explícita para ese caso puntual en vez de confiar en que el límite
 * genérico ya lo cubre.
 */
export class FavorBrevityRule implements ConversationRule {
  readonly id = "favor-brevity";

  applies(_input: ConversationRuleInput): boolean {
    return true;
  }

  directive(_input: ConversationRuleInput): string {
    return "LÍMITE DURO, por encima de cualquier otra instrucción de esta lista: 2 a 4 líneas máximo, sin títulos, sin listas numeradas, sin secciones — como un mensaje de texto real, no un documento. Si sientes que necesitas más espacio, es señal de que estás resolviendo en vez de acompañar. Responde corto y, si hace falta, continúa en el siguiente mensaje. Esto aplica también, sin excepción, si te preguntan qué puedes hacer o cómo puedes ayudar: no respondas con un menú ni una lista de capacidades — responde con una o dos frases concretas y sigue con una pregunta o propuesta, igual que con cualquier otro mensaje.";
  }
}
