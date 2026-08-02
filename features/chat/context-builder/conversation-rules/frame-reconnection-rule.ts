import type {
  ConversationRule,
  ConversationRuleInput,
} from "./conversation-rule";

const CONTINUATION_FRAMING: Record<string, string> = {
  welcome_back:
    "Es un segundo intento real, no el primero -- nunca lo trates como si empezara de cero.",
  echo: "Un capítulo pasado de esta misma historia cae justo en esta fecha -- puede valer la pena notarlo, sin forzarlo.",
  resume: "Sigue abierta, sin urgencia especial -- retómala con naturalidad si viene a cuento.",
  check_in: "El momento para volver a mirar esto ya llegó.",
  celebrate: "Tuvo un desenlace real y positivo que todavía no se reconoció.",
  reflect: "Cerró hace poco -- vale la pena mirar atrás, brevemente.",
  prepare: "Hay algo próximo y ya fechado relacionado con esto.",
  release: "Se está apagando sin evidencia nueva -- nunca cerrarla por su cuenta, solo nombrarlo con honestidad si aplica.",
};

/**
 * "Qué cambió desde la última interacción" + "qué capítulo vive"
 * (redesign del pipeline conversacional, Beta) -- se activa solo
 * cuando `assembleReconnectionContext` ya determinó que hay un vacío
 * real desde la última vez que se habló y algo genuino que decir al
 * respecto, usando el `NarrativeState` real (`features/narrative`),
 * nunca una interpretación propia más simple. Regla pura sobre datos
 * ya resueltos, mismo criterio que las otras tres: nunca hace su
 * propia consulta.
 */
export class FrameReconnectionRule implements ConversationRule {
  readonly id = "frame-reconnection";

  applies(input: ConversationRuleInput): boolean {
    const context = input.reconnectionContext;
    return Boolean(context && (context.activeThread || context.changes.length > 0));
  }

  directive(input: ConversationRuleInput): string {
    const context = input.reconnectionContext;
    if (!context) {
      return "";
    }

    const lines: string[] = [
      "Ha pasado un vacío real desde la última vez que hablaron -- este es el primer mensaje después de eso:",
    ];

    for (const change of context.changes) {
      lines.push(`- ${change.summary}`);
    }

    if (context.continuation && context.activeThread) {
      lines.push(
        `- Sigue a mitad de una historia real: "${context.activeThread.title}" (${context.activeThread.chapterLabel.toLowerCase()}) -- ${context.activeThread.summary}`,
      );
      const framing = CONTINUATION_FRAMING[context.continuation.kind];
      if (framing) {
        lines.push(`- ${framing}`);
      }
    }

    lines.push(
      "Úsalo para que el reencuentro se sienta real -- no lo recites como una lista de novedades, y no lo fuerces si el mensaje de la persona ya trae su propio tema.",
    );

    return lines.join("\n");
  }
}
