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
 * (`RealitySnapshot.fadingBeliefs` -- traducción neutral de
 * `features/identity-evolution`, `IdentitySnapshot.deemphasized[0]`:
 * una dimensión/tema históricamente fuerte que ya está
 * `dormant`/`declining`, con memoria real de largo plazo detrás, no un
 * simple chequeo de estado de una sola creencia). La respuesta
 * concreta a "qué ya dejó de definirla" del redesign del pipeline
 * conversacional (Beta).
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
    const deemphasized = input.realitySnapshot.fadingBeliefs.items[0];

    if (!deemphasized) {
      throw new Error(
        "ReleaseStrategyRule.explain(): llamado sin que appliesTo() haya sido true primero.",
      );
    }

    return {
      strategy: this.id,
      reason: `Algo que antes era central en esta persona ya dejó de serlo: "${deemphasized.statement}".`,
      primaryObjective:
        "Si surge una oportunidad natural en la conversación, reconoce con calidez que esto ya no la define como antes -- nunca como una pérdida, como parte de cómo ha cambiado.",
      avoid:
        "Forzarlo si no conecta con lo que dice ahora mismo, sonar como si estuviera corrigiendo un error suyo, o tratar el cambio como algo que hay que explicar o justificar.",
    };
  }
}
