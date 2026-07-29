import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";
import type {
  ConversationStrategyRule,
  ConversationStrategyRuleInput,
} from "./conversation-strategy-rule";

/**
 * Fast User Understanding: una hipótesis sobre la persona todavía en
 * formación (`RealitySnapshot.growingBeliefs`, confianza 30-54 --
 * `assembleRealitySnapshot`) merece confirmarse de forma orgánica,
 * nunca compartirse como un hecho (eso exige `ReflectStrategyRule`,
 * confianza >=55) ni ignorarse hasta que se resuelva sola. Confirmar
 * temprano es lo que reduce el tiempo real hasta que LUZ entiende a
 * alguien -- la respuesta de la persona, sea que confirme o corrija,
 * ya fluye como una memoria nueva y refuerza o debilita la misma
 * creencia por el camino existente (`consolidateBeliefFromInsight`,
 * `titlesLikelyMatch`) -- esta regla no necesita ningún mecanismo
 * nuevo de seguimiento para eso.
 *
 * Prioridad 42, entre `CelebrateStrategyRule` (45, un momento real no
 * debe perder su turno por una hipótesis pendiente) y
 * `CuriosityStrategyRule` (40, explorar un vacío total es más abierto
 * y menos urgente que verificar algo que ya se empezó a notar).
 * Directo a `realitySnapshot.growingBeliefs`, nunca a `contextItems`
 * (Context Engine no conoce esta fuente) -- mismo patrón que
 * `ReflectStrategyRule`/`CuriosityStrategyRule`.
 */
export class ConfirmStrategyRule implements ConversationStrategyRule {
  readonly id: ConversationStrategyType = "confirm";
  readonly priority = 42;

  appliesTo(input: ConversationStrategyRuleInput): boolean {
    if (input.isFirstContact) {
      return false;
    }
    return input.realitySnapshot.growingBeliefs.items.length > 0;
  }

  explain(input: ConversationStrategyRuleInput): ConversationStrategyDirective {
    const belief = input.realitySnapshot.growingBeliefs.items[0];

    if (!belief) {
      throw new Error(
        "ConfirmStrategyRule.explain(): llamado sin que appliesTo() haya sido true primero.",
      );
    }

    return {
      strategy: this.id,
      reason: `LUZ tiene una hipótesis todavía en formación, no una certeza (confianza ${belief.confidence}/100): "${belief.statement}".`,
      primaryObjective:
        `Si surge una oportunidad natural en la conversación, confirma esta interpretación con tus propias palabras, cálidamente, como quien comparte una impresión -- nunca como una pregunta de formulario. Ejemplo de tono: "Creo que le estás dedicando mucha energía a esto últimamente. ¿Lo interpreté bien?"`,
      avoid:
        "Presentarlo como un hecho ya confirmado, forzarlo si no conecta con lo que dice ahora mismo, o encadenarlo con otra pregunta.",
    };
  }
}
