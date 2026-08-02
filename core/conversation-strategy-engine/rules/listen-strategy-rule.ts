import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";
import type {
  ConversationStrategyRule,
  ConversationStrategyRuleInput,
} from "./conversation-strategy-rule";
import { isStrategyOnCooldown } from "./diversity-cooldown";

/**
 * Qué nombrar cuando `Listen` gana el turno específicamente porque el
 * cooldown de diversidad (redesign del pipeline conversacional, Beta)
 * acaba de suprimir a la postura que de otra forma habría ganado --
 * "qué merece silencio", hecho legible. El chat es reactivo (un
 * mensaje que la persona ya envió siempre necesita respuesta, ver
 * `DefaultPresenceEngine`), así que el silencio literal no es la
 * respuesta -- la restricción deliberada sí lo es: en vez de un
 * "ninguna señal domina" genérico, `Listen` puede decir la verdad más
 * específica, "ya lo dije/pregunté/celebré hace poco, hoy toca
 * escuchar" -- una decisión de la capa de Strategy, nunca una omisión
 * accidental.
 */
const RESTRAINT_LABEL: Record<string, string> = {
  celebrate: "algo que valía la pena reconocer",
  reflect: "una comprensión ya compartida",
  confirm: "una hipótesis ya ofrecida a confirmar",
  curiosity: "una pregunta ya hecha",
  release: "un capítulo cerrado ya nombrado",
};

/**
 * El piso de todo el conjunto — la única regla incondicional
 * (`appliesTo` siempre `true`), con la prioridad más baja. Garantiza
 * que `DefaultConversationStrategyEngine.select()` siempre tenga una
 * estrategia que devolver, incluso sin ninguna señal estructural
 * (primer contacto, o una conversación en curso sin nada que otra
 * regla haya reconocido). Sin esta regla, "ninguna estrategia aplicó"
 * sería un estado real y habría que decidir qué hacer con él — con
 * ella, ese estado nunca ocurre.
 */
export class ListenStrategyRule implements ConversationStrategyRule {
  readonly id: ConversationStrategyType = "listen";
  readonly priority = 5;

  appliesTo(_input: ConversationStrategyRuleInput): boolean {
    return true;
  }

  explain(input: ConversationStrategyRuleInput): ConversationStrategyDirective {
    const suppressed = this.mostRecentSuppressedStrategy(input);

    if (suppressed) {
      return {
        strategy: this.id,
        reason: `La postura más reciente (${suppressed}) ya ganó el turno seguido antes -- ${RESTRAINT_LABEL[suppressed]}, no hace falta repetirlo hoy.`,
        primaryObjective:
          "Escuchar de verdad, sin forzar una nueva versión de lo mismo que ya se dijo -- el silencio sobre ese tema puntual es la decisión correcta, no una ausencia.",
        avoid: "Repetir con otras palabras lo que ya se reconoció/preguntó/compartió recientemente, solo para no quedarse callada al respecto.",
      };
    }

    return {
      strategy: this.id,
      reason: input.isFirstContact
        ? "Es el primer mensaje real de esta conversación — todavía no hay contexto acumulado sobre esta persona."
        : "Ninguna señal estructural domina ahora mismo — ni un patrón, ni un riesgo, ni una fecha próxima, ni algo pendiente de retomar.",
      primaryObjective: "Entender antes que resolver — dejar que la persona guíe de qué se trata este momento.",
      avoid: "Ofrecer soluciones o interpretaciones antes de entender qué está pasando de verdad.",
    };
  }

  /**
   * `undefined` si la más reciente no es una de las posturas con
   * cooldown, o si ya no está en racha -- en ese caso `Listen` ganó por
   * la razón genérica de siempre (nada dominaba), no por restricción.
   */
  private mostRecentSuppressedStrategy(
    input: ConversationStrategyRuleInput,
  ): string | undefined {
    const mostRecent = input.recentStrategyTypes[0];
    if (!mostRecent || !(mostRecent in RESTRAINT_LABEL)) {
      return undefined;
    }
    return isStrategyOnCooldown(mostRecent, input.recentStrategyTypes)
      ? mostRecent
      : undefined;
  }
}
