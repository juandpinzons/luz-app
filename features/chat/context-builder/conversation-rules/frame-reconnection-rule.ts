import type {
  ConversationRule,
  ConversationRuleInput,
} from "./conversation-rule";

/**
 * "Qué cambió desde la última interacción" + "qué capítulo vive"
 * (redesign del pipeline conversacional, Beta) -- se activa solo
 * cuando `assembleReconnectionContext` ya determinó que hay un vacío
 * real desde la última vez que se habló y algo genuino que decir al
 * respecto. Regla pura sobre datos ya resueltos, mismo criterio que
 * las otras tres: nunca hace su propia consulta.
 */
export class FrameReconnectionRule implements ConversationRule {
  readonly id = "frame-reconnection";

  applies(input: ConversationRuleInput): boolean {
    const context = input.reconnectionContext;
    return Boolean(context && (context.chapter || context.changes.length > 0));
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

    if (context.chapter) {
      lines.push(
        `- Ahora mismo, lo que más ocupa activamente a esta persona es ${context.chapter.label}.`,
      );
    }

    lines.push(
      "Úsalo para que el reencuentro se sienta real -- no lo recites como una lista de novedades, y no lo fuerces si el mensaje de la persona ya trae su propio tema.",
    );

    return lines.join("\n");
  }
}
