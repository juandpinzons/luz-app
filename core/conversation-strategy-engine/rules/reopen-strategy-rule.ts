import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";
import type {
  ConversationStrategyRule,
  ConversationStrategyRuleInput,
} from "./conversation-strategy-rule";

/**
 * Continuidad al reabrir (`docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md`
 * §3.6, `FollowUpOnOpenLoopRule`, adaptada a Conversation Strategy en
 * vez de a una `ConversationRule` aditiva -- así compite de verdad por
 * el turno contra Challenge/Encourage/etc. en vez de coordinar
 * exclusión a mano). Retoma una intención sin resolver
 * (`RealitySnapshot.reopenCandidates`, Memory `type: "intention"` ya
 * filtrada por `seen_prompts` en la capa de aplicación) -- únicamente
 * al reabrir, nunca a mitad de una conversación en curso (eso es
 * `follow_up`, sobre una memoria que se enfrió, condición distinta).
 *
 * Prioridad 56, entre `RemindStrategyRule` (65, una fecha próxima
 * sigue ganando primero) y `FollowUpStrategyRule` (55, que de todas
 * formas nunca compite en el mismo turno -- disparan sobre
 * `isFirstContact` opuestos). Una intención que la persona nombró
 * explícitamente es más concreta que un goal genérico sin fecha.
 */
export class ReopenStrategyRule implements ConversationStrategyRule {
  readonly id: ConversationStrategyType = "reopen";
  readonly priority = 56;

  appliesTo(input: ConversationStrategyRuleInput): boolean {
    if (!input.isFirstContact) {
      return false;
    }
    return input.realitySnapshot.reopenCandidates.items.length > 0;
  }

  explain(input: ConversationStrategyRuleInput): ConversationStrategyDirective {
    const intention = input.realitySnapshot.reopenCandidates.items[0];

    if (!intention) {
      throw new Error(
        "ReopenStrategyRule.explain(): llamado sin que appliesTo() haya sido true primero.",
      );
    }

    return {
      strategy: this.id,
      reason: `La persona mencionó antes una intención sin resolver: "${intention.statement}".`,
      primaryObjective:
        "Antes de seguir con lo que sea que diga ahora, retoma esa intención con naturalidad -- '¿cómo quedó...?' -- como quien de verdad se acordó, no como un pendiente administrativo.",
      avoid:
        "Sonar como un recordatorio de tarea, forzarlo si el primer mensaje ya trae un tema propio y urgente, o repetirlo textual en vez de con palabras propias.",
    };
  }
}
