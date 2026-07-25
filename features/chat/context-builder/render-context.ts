import type { AIMessage } from "../../../ai/provider";
import type {
  ConversationStrategyDirective,
  ConversationStrategyType,
} from "../../../core/conversation-strategy-engine";
import { renderIdentityAsSystemPrompt } from "../../../core/persona";
import type { Context } from "./context";

/**
 * Etiqueta de presentación para cada `ConversationStrategyType` —
 * `core/conversation-strategy-engine` guarda el vocabulario interno en
 * snake_case (`follow_up`), esta es la única traducción a la forma que
 * ve el modelo. Vive aquí, no en `core/`: el Prompt Builder es la
 * única capa que sabe que existe un LLM del otro lado (mismo criterio
 * que el resto de este archivo).
 */
const STRATEGY_LABEL: Record<ConversationStrategyType, string> = {
  listen: "Listen",
  clarify: "Clarify",
  encourage: "Encourage",
  challenge: "Challenge",
  celebrate: "Celebrate",
  remind: "Remind",
  plan: "Plan",
  follow_up: "FollowUp",
};

/**
 * El bloque explícito que le dice al modelo qué intención ya se
 * decidió — nunca una etiqueta suelta: la razón, el objetivo principal
 * y qué evitar, todos derivados de datos reales por
 * `ConversationStrategyRule.explain()`, nunca texto fijo repetido
 * entre estrategias.
 */
function renderConversationStrategy(directive: ConversationStrategyDirective): string {
  return [
    "Conversation Strategy:",
    STRATEGY_LABEL[directive.strategy],
    "Reason:",
    directive.reason,
    "Primary Objective:",
    directive.primaryObjective,
    "Avoid:",
    directive.avoid,
  ].join("\n");
}

/**
 * Traduce un `Context` ya construido a lo único que `AIProvider`
 * conoce — un arreglo de `AIMessage` (Sprint B3, Beta 1 Roadmap). Es
 * la única función que sabe que existe un LLM del otro lado; el resto
 * del Context Builder (reglas, ensamblador, Context Strategy Engine)
 * no lo sabe ni le importa. `AIProvider.generateReply()` no cambia —
 * sigue recibiendo exactamente lo mismo que antes de este sprint, solo
 * mejor construido.
 *
 * Las directivas de las reglas se combinan en un único mensaje
 * `system` — varias reglas pequeñas, un solo mensaje, nunca el manual
 * completo convertido en prompt. `conversationStrategy` es su propio
 * mensaje `system`, siempre presente (`ConversationStrategyEngine.select()`
 * nunca devuelve ausencia — `ListenStrategyRule` es el catch-all) y
 * deliberadamente separado de las reglas: las reglas son modales de
 * comportamiento permanente (brevedad, no parafrasear), la estrategia
 * es la postura de esta respuesta puntual — mezclarlas en un solo
 * mensaje les restaría la prominencia que el ejemplo del sprint pide.
 *
 * La identidad (`core/persona`) va primero, siempre, en todo mensaje
 * — no condicionada a que alguien pregunte quién es LUZ. Es la única
 * forma de que la respuesta sea consistente sin importar el turno: el
 * modelo nunca tiene que adivinar ni inventar de dónde viene.
 */
export function renderContextToMessages(context: Context): AIMessage[] {
  const systemMessages: AIMessage[] = [
    { role: "system", content: renderIdentityAsSystemPrompt() },
  ];

  if (context.conversationRules.length > 0) {
    systemMessages.push({
      role: "system",
      content: context.conversationRules
        .map((rule) => `- ${rule.instruction}`)
        .join("\n"),
    });
  }

  systemMessages.push({
    role: "system",
    content: renderConversationStrategy(context.conversationStrategy),
  });

  return [
    ...systemMessages,
    ...context.conversation.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
  ];
}
