import { LIFE_DOMAIN_LABEL } from "../../life/value-objects/life-domain-label";
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";
import type { RealityDomainCoverage } from "../../reality";
import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";
import type {
  ConversationStrategyRule,
  ConversationStrategyRuleInput,
} from "./conversation-strategy-rule";
import { isStrategyOnCooldown } from "./diversity-cooldown";

/**
 * Por debajo de esto, un dominio cuenta como "sin explorar" -- mismo
 * espíritu que el antiguo `MIN_STRUCTURED_ITEMS`, ahora expresado en la
 * escala 0-100 de `computeDomainCoverage` (`core/knowledge-gaps`) en
 * vez de un conteo crudo de filas.
 */
const GAP_THRESHOLD = 25;

/**
 * Cuánta cobertura total (sumada entre TODOS los dominios) hace falta
 * para que "ningún dominio cubierto todavía" no se confunda con "recién
 * empezamos" (eso ya lo cubre `ListenStrategyRule`/primer contacto) —
 * la curiosidad genuina necesita ALGO de estructura ya real contra la
 * cual notar un vacío, no dispara sobre una cuenta completamente vacía.
 */
const MIN_TOTAL_COVERAGE = 1;

/**
 * `excludeDomain` (Conversational Variety V1, `features/conversational-variety`)
 * -- el dominio menos cubierto podría, en el mismo turno, ser
 * exactamente el que ha dominado las conversaciones recientes; sin
 * esto, Curiosity podría profundizar en un vacío estructural real
 * mientras, a la vez, satura ese mismo tema en la conversación.
 * `rankKnowledgeGaps` siempre entrega las 8 `LifeDomainType` (ver su
 * propio docblock), así que excluir una nunca deja el pool vacío.
 */
function leastCoveredDomain(
  domains: RealityDomainCoverage[],
  excludeDomain: LifeDomainType | null,
): RealityDomainCoverage | undefined {
  // `rankKnowledgeGaps` ya entrega orden ascendente por convención
  // documentada, pero esta regla no depende de eso sin verificarlo --
  // un dato mal ordenado en un futuro cambio no debería producir la
  // pregunta equivocada en silencio.
  return domains
    .filter((item) => item.domain !== excludeDomain)
    .reduce<RealityDomainCoverage | undefined>((min, current) => {
      if (!min || current.coverageScore < min.coverageScore) return current;
      return min;
    }, undefined);
}

const AVOID =
  "Forzar el tema si no conecta con lo que la persona está diciendo ahora mismo, encadenar varias preguntas, o que se sienta como una entrevista en vez de una conversación real.";

/**
 * Curiosidad genuina por una parte de la vida de esta persona que LUZ
 * todavía entiende poco (`RealitySnapshot.knowledgeGaps`,
 * `core/knowledge-gaps` -- Goal/Project/Habit.domain, Beliefs y
 * Concepts ya clasificados, dato real, nunca inventado aquí). Cuando
 * `RealitySnapshot.curiosity.pendingQuestion` existe (Curiosity Engine
 * ya pensó una pregunta concreta para ese vacío, ver
 * `core/curiosity-engine`), se usa esa -- nunca una instrucción vaga
 * que el LLM tiene que improvisar en el momento. Sin ninguna pendiente
 * todavía (p. ej. el cron de generación no ha corrido para este
 * LifeGraph), se degrada al criterio anterior: detectar el vacío en el
 * momento y pedirle al LLM que muestre curiosidad genérica por esa
 * área.
 *
 * Prioridad deliberadamente baja: un riesgo, un patrón de
 * postergación, un plan concreto o un recordatorio pendiente siempre le
 * ganan a la curiosidad exploratoria
 * (`ChallengeStrategyRule`/`EncourageStrategyRule`/`PlanStrategyRule`/
 * `RemindStrategyRule`, todas con prioridad mayor) — pero por encima de
 * `ClarifyStrategyRule` (35) y del catch-all `ListenStrategyRule` (5):
 * "hay una parte entera de su vida sin explorar" es una señal más
 * específica y útil que "nada domina" o "un empate ambiguo".
 */
export class CuriosityStrategyRule implements ConversationStrategyRule {
  readonly id: ConversationStrategyType = "curiosity";
  readonly priority = 40;

  appliesTo(input: ConversationStrategyRuleInput): boolean {
    if (input.isFirstContact) {
      return false;
    }

    // Redesign del pipeline conversacional (Beta): sin esto, la MISMA
    // `CuriosityQuestion` pendiente (que no cambia hasta que el
    // dominio mejore o el cron genere otra, ver
    // `generate-curiosity-question.ts`) puede ganar el turno semana
    // tras semana -- exactamente el "LUZ sigue abriendo con lo mismo"
    // que este redesign existe para arreglar.
    if (isStrategyOnCooldown(this.id, input.recentStrategyTypes)) {
      return false;
    }

    const pending = input.realitySnapshot.curiosity.pendingQuestion;
    // Conversational Variety V1: una pregunta pendiente sobre el
    // dominio que ya domina las conversaciones recientes repetiría
    // exactamente el "LUZ obsesionada con un tema" que ese módulo
    // existe para evitar -- se ignora aquí (no se descarta, sigue
    // pendiente para cuando el dominio deje de estar fatigado) y se
    // sigue de largo hacia el vacío estructural.
    if (pending && pending.domain !== input.fatiguedDomain) {
      return true;
    }

    const { domains } = input.realitySnapshot.knowledgeGaps;
    const totalCoverage = domains.reduce((sum, item) => sum + item.coverageScore, 0);
    if (totalCoverage < MIN_TOTAL_COVERAGE) {
      return false;
    }

    const weakest = leastCoveredDomain(domains, input.fatiguedDomain);
    return weakest !== undefined && weakest.coverageScore < GAP_THRESHOLD;
  }

  explain(input: ConversationStrategyRuleInput): ConversationStrategyDirective {
    const pending = input.realitySnapshot.curiosity.pendingQuestion;
    if (pending && pending.domain !== input.fatiguedDomain) {
      const label = LIFE_DOMAIN_LABEL[pending.domain];
      return {
        strategy: this.id,
        reason: `LUZ todavía entiende poco sobre ${label} y ya tiene una pregunta concreta pensada para eso.`,
        primaryObjective: `Si surge una oportunidad natural en lo que dice, puedes preguntarle esto, adaptado al momento (no la repitas textual si no encaja): "${pending.question}"`,
        avoid: AVOID,
      };
    }

    const weakest = leastCoveredDomain(
      input.realitySnapshot.knowledgeGaps.domains,
      input.fatiguedDomain,
    );

    if (!weakest) {
      throw new Error(
        "CuriosityStrategyRule.explain(): llamado sin que appliesTo() haya sido true primero.",
      );
    }

    const label = LIFE_DOMAIN_LABEL[weakest.domain];

    return {
      strategy: this.id,
      reason: `LUZ todavía entiende poco sobre ${label} -- ningún objetivo, proyecto, hábito o creencia consolidada ahí todavía.`,
      primaryObjective:
        `Si surge una oportunidad natural en lo que dice, muestra curiosidad genuina por ${label} -- una pregunta concreta y específica sobre su vida real, nunca genérica.`,
      avoid: AVOID,
    };
  }
}
