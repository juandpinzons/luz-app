import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";
import type {
  ConversationStrategyRule,
  ConversationStrategyRuleInput,
} from "./conversation-strategy-rule";
import { isStrategyOnCooldown } from "./diversity-cooldown";

/**
 * La contraparte de `ReflectStrategyRule` para Identity Evolution: en
 * vez de compartir algo que LUZ entendió y que sigue sosteniéndose,
 * nombra algo que dejó de definir a esta persona
 * (`RealitySnapshot.fadingBeliefs` -- `core/belief-engine`, un Belief
 * que pasó a `expired`/`retracted`). La respuesta concreta a "qué ya
 * dejó de definirla" del redesign del pipeline conversacional (Beta).
 *
 * Prioridad 44, justo debajo de `CelebrateStrategyRule` (45): un
 * capítulo cerrado es una señal real y específica, pero un momento
 * bueno que acaba de pasar sigue ganando primero si ambos compiten el
 * mismo turno. Justo encima de `ConfirmStrategyRule` (42): una
 * creencia que ya se soltó es más concreta que una todavía en
 * formación.
 */
export class ReleaseStrategyRule implements ConversationStrategyRule {
  readonly id: ConversationStrategyType = "release";
  readonly priority = 44;

  appliesTo(input: ConversationStrategyRuleInput): boolean {
    // Nunca en el primer mensaje de una conversación nueva -- abrir
    // nombrando algo que la persona dejó atrás sería un arranque frío,
    // mismo criterio que `ReflectStrategyRule`/`ChallengeStrategyRule`.
    if (input.isFirstContact) {
      return false;
    }
    if (isStrategyOnCooldown(this.id, input.recentStrategyTypes)) {
      return false;
    }
    return input.realitySnapshot.fadingBeliefs.items.length > 0;
  }

  explain(input: ConversationStrategyRuleInput): ConversationStrategyDirective {
    const belief = input.realitySnapshot.fadingBeliefs.items[0];

    if (!belief) {
      throw new Error(
        "ReleaseStrategyRule.explain(): llamado sin que appliesTo() haya sido true primero.",
      );
    }

    return {
      strategy: this.id,
      reason: `Algo que antes era cierto sobre esta persona ya dejó de sostenerse: "${belief.statement}".`,
      primaryObjective:
        "Si surge una oportunidad natural en la conversación, reconoce con calidez que esto ya no la define como antes -- nunca como una pérdida, como parte de cómo ha cambiado.",
      avoid:
        "Forzarlo si no conecta con lo que dice ahora mismo, sonar como si estuviera corrigiendo un error suyo, o tratar el cambio como algo que hay que explicar o justificar.",
    };
  }
}
