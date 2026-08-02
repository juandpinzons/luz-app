import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";
import type {
  ConversationStrategyRule,
  ConversationStrategyRuleInput,
} from "./conversation-strategy-rule";
import { isStrategyOnCooldown } from "./diversity-cooldown";

/**
 * LUZ ya llegó a una comprensión real sobre la persona -- combinando
 * varios insights ya validados, no interpretando uno solo
 * (`RealitySnapshot.reasoning`, `core/knowledge-engine/reasoning`).
 * Compartirla es lo que separa "recordar lo que se dijo" de "entender
 * lo que significa": el ejemplo del bloque de trabajo -- "he notado
 * que cuando hablas de trabajo también aparece con frecuencia la
 * sensación de agotamiento" -- nunca debería generarse desde cero en
 * el momento, siempre debería venir de una `ReasoningConclusion` que
 * ya pasó por evidencia, correlación y validación (Gather→Correlate→
 * Reason→Validate→Persist).
 *
 * Prioridad: por debajo de todo lo accionable-ahora-mismo
 * (`ChallengeStrategyRule` 95, `EncourageStrategyRule` 85,
 * `PlanStrategyRule` 75, `RemindStrategyRule` 65, `FollowUpStrategyRule`
 * 55 -- todas resuelven algo que la persona necesita en este momento
 * puntual), pero por encima de `CelebrateStrategyRule` (45) y
 * `CuriosityStrategyRule` (40): una conclusión ya respaldada por
 * evidencia correlacionada es una señal más sólida que una única
 * memoria reciente o un área de vida sin explorar todavía.
 */
export class ReflectStrategyRule implements ConversationStrategyRule {
  readonly id: ConversationStrategyType = "reflect";
  readonly priority = 50;

  appliesTo(input: ConversationStrategyRuleInput): boolean {
    if (input.isFirstContact) {
      return false;
    }
    if (isStrategyOnCooldown(this.id, input.recentStrategyTypes)) {
      return false;
    }
    return input.realitySnapshot.reasoning.items.length > 0;
  }

  explain(input: ConversationStrategyRuleInput): ConversationStrategyDirective {
    // Ya viene ordenada por confianza (y desempatada por recencia) desde
    // `assembleRealitySnapshot` -- la primera es la más sólida, nunca
    // se vuelve a decidir ese orden aquí.
    const conclusion = input.realitySnapshot.reasoning.items[0];

    if (!conclusion) {
      throw new Error(
        "ReflectStrategyRule.explain(): llamado sin que appliesTo() haya sido true primero.",
      );
    }

    return {
      strategy: this.id,
      reason: `LUZ ya entendió algo real, respaldado por varias piezas de evidencia correlacionadas: "${conclusion.statement}" (confianza ${conclusion.confidenceScore}/100).`,
      primaryObjective:
        "Si surge una oportunidad natural en la conversación, comparte esta comprensión con tus propias palabras -- nunca cites la frase exacta, exprésala como algo que de verdad notaste sobre su vida.",
      avoid:
        `Forzarla si no conecta con lo que la persona dice ahora mismo, sonar como un diagnóstico o una etiqueta fija, o presentarla como certeza absoluta -- es una observación con ${conclusion.confidenceScore}/100 de confianza, no un hecho cerrado.`,
    };
  }
}
