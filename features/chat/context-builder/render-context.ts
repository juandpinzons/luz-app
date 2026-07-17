import type { AIMessage } from "../../../ai/provider";
import type { Context } from "./context";

/**
 * Traduce un `Context` ya construido a lo único que `AIProvider`
 * conoce — un arreglo de `AIMessage` (Sprint B3, Beta 1 Roadmap).
 * Es la única función que sabe que existe un LLM del otro lado; el
 * resto del Context Builder (reglas, ensamblador) no lo sabe ni le
 * importa. `AIProvider.generateReply()` no cambia — sigue recibiendo
 * exactamente lo mismo que antes de este sprint, solo mejor construido.
 *
 * Las directivas de las reglas se combinan en un único mensaje
 * `system` — varias reglas pequeñas, un solo mensaje, nunca el manual
 * completo convertido en prompt.
 */
export function renderContextToMessages(context: Context): AIMessage[] {
  const systemMessages: AIMessage[] =
    context.conversationRules.length > 0
      ? [
          {
            role: "system",
            content: context.conversationRules
              .map((rule) => `- ${rule.instruction}`)
              .join("\n"),
          },
        ]
      : [];

  return [
    ...systemMessages,
    ...context.conversation.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
  ];
}
