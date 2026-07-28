import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";
import { prioritizedInsights, prioritizedLifeItems } from "./context-item-helpers";
import type {
  ConversationStrategyRule,
  ConversationStrategyRuleInput,
} from "./conversation-strategy-rule";

/** Coincide con `INSIGHT_TYPES` (`core/knowledge-engine/value-objects/insight-type.ts`) — mismo criterio que `RealityInsightItem.type: string` para no importar el value object del engine dentro de este cruce. */
const PATTERN_INSIGHT_TYPE = "pattern";

/**
 * La más alta prioridad del conjunto: un patrón de comportamiento ya
 * identificado por Knowledge Engine (p. ej. postergar una decisión una
 * y otra vez) sobre algo que sigue activo en Life State no es una
 * señal para acompañar con más suavidad — es la señal para confrontar
 * con algo concreto. Exactamente el ejemplo del sprint: "User has
 * postponed the same high-priority goal multiple times."
 *
 * Una contradicción real ya detectada por `core/contradiction-engine`
 * (`RealitySnapshot.contradictions`, ver `assembleRealitySnapshot`) es
 * la misma clase de señal -- una tensión concreta y específica, no una
 * lectura general del momento -- así que dispara la misma postura. Se
 * evalúa primero: una tensión ya detectada por comparación explícita
 * (belief vs. belief, belief vs. goal) es evidencia más directa que un
 * patrón inferido de insights repetidos, y solo una puede nombrarse
 * por turno (ver límite en el ensamblador) para no sonar como una
 * acumulación de cargos.
 */
export class ChallengeStrategyRule implements ConversationStrategyRule {
  readonly id: ConversationStrategyType = "challenge";
  readonly priority = 95;

  appliesTo(input: ConversationStrategyRuleInput): boolean {
    return this.hasOpenContradiction(input) || this.hasUnresolvedPattern(input);
  }

  explain(input: ConversationStrategyRuleInput): ConversationStrategyDirective {
    const contradiction = input.realitySnapshot.contradictions.items[0];
    if (contradiction) {
      return {
        strategy: this.id,
        reason: `LUZ ya detectó una tensión real, no inferida: "${contradiction.description}".`,
        primaryObjective:
          "Nombra la tensión con calidez y sin juicio, y ayúdala a mirarla de frente -- qué cambió, o cuál de las dos partes sigue siendo cierta para ella hoy.",
        avoid:
          'Sonar como una acusación o un "te contradices" -- es una tensión real y humana, no un error suyo que corregir.',
      };
    }

    const patternInsight = prioritizedInsights(input).find(
      (insight) => insight.type === PATTERN_INSIGHT_TYPE,
    );
    const lifeItem = prioritizedLifeItems(input)[0];

    if (!patternInsight || !lifeItem) {
      throw new Error(
        "ChallengeStrategyRule.explain(): llamado sin que appliesTo() haya sido true primero.",
      );
    }

    return {
      strategy: this.id,
      reason: `Patrón ya identificado sobre esta persona: "${patternInsight.description}" — y "${lifeItem.label}" sigue activo, sin resolver.`,
      primaryObjective: `Ayudarla a comprometerse con una acción concreta y específica sobre "${lifeItem.label}" — no otra reflexión general sobre el tema.`,
      avoid: "Repetir consejos que ya se le han dado antes, o suavizar el punto hasta que pierda su fuerza.",
    };
  }

  /** Nunca en el primer mensaje de una conversación nueva -- abrir con una tensión detectada sería un arranque frío, mismo criterio que `ReflectStrategyRule`. */
  private hasOpenContradiction(input: ConversationStrategyRuleInput): boolean {
    return !input.isFirstContact && input.realitySnapshot.contradictions.items.length > 0;
  }

  private hasUnresolvedPattern(input: ConversationStrategyRuleInput): boolean {
    const hasPattern = prioritizedInsights(input).some(
      (insight) => insight.type === PATTERN_INSIGHT_TYPE,
    );
    return hasPattern && prioritizedLifeItems(input).length > 0;
  }
}
