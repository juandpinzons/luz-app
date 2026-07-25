import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";
import { prioritizedLifeItems, prioritizedMemories } from "./context-item-helpers";
import type {
  ConversationStrategyRule,
  ConversationStrategyRuleInput,
} from "./conversation-strategy-rule";

/**
 * Algo del Life State activo sigue mereciendo atención (ya pasó el
 * corte de Context Engine) pero ninguna memoria reciente lo respalda
 * — nadie lo ha mencionado, no está siendo trabajado en esta
 * conversación. Distinta de `PlanStrategyRule`: ahí hay una fecha
 * cerca o una recomendación, aquí no hay urgencia, solo el riesgo de
 * que se pierda de vista.
 */
export class RemindStrategyRule implements ConversationStrategyRule {
  readonly id: ConversationStrategyType = "remind";
  readonly priority = 65;

  appliesTo(input: ConversationStrategyRuleInput): boolean {
    return prioritizedLifeItems(input).length > 0 && prioritizedMemories(input).length === 0;
  }

  explain(input: ConversationStrategyRuleInput): ConversationStrategyDirective {
    const lifeItem = prioritizedLifeItems(input)[0];

    if (!lifeItem) {
      throw new Error(
        "RemindStrategyRule.explain(): llamado sin que appliesTo() haya sido true primero.",
      );
    }

    return {
      strategy: this.id,
      reason: `"${lifeItem.label}" sigue activo, pero no ha aparecido en la memoria reciente de esta conversación.`,
      primaryObjective: `Traer "${lifeItem.label}" de vuelta a la conversación con suavidad, sin presionar.`,
      avoid: "Sonar como una notificación automática o una lista de pendientes.",
    };
  }
}
