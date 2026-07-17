import type { GeneratedInsight } from "../generation/insight-generation-strategy";
import type { PipelineContext } from "../pipeline-context";
import type { Confidence } from "../value-objects/confidence";
import type { InsightStatus } from "../value-objects/insight-status";
import type {
  InsightValidationStrategy,
  ValidatedInsight,
} from "./insight-validation-strategy";

/**
 * Umbral fijo de confianza: la propuesta se valida cuando el LLM (o
 * quien genere `GeneratedInsight`) está más seguro de que es cierta que
 * de lo contrario. Deliberadamente conservador y el más simple de las
 * tres formas de validar que el propio contrato ya nombra (umbral fijo,
 * reglas explícitas, intervención humana) — primera iteración de una
 * capacidad que seguirá evolucionando, no el umbral final.
 */
export const VALIDATION_CONFIDENCE_THRESHOLD = 50;

/**
 * `proposedConfidence` es un número externo sin garantías — hoy lo
 * produce lógica determinista, mañana puede venir de un LLM. Nunca se
 * confía en él sin sanear: fuera de 0-100 se recorta, no numérico se
 * trata como 0 (la propuesta menos confiable posible, nunca se asume
 * confianza que nadie declaró).
 */
function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Dos reglas, ambas deterministas y ambas ligadas a un principio ya
 * establecido, no inventadas:
 *
 * 1. Sin evidencia, rechazado sin importar la confianza propuesta — un
 *    insight sin `evidence` no puede responder "¿qué evidencia lo
 *    produjo?" (Principio 3, explicabilidad). No es un umbral, es un
 *    requisito absoluto.
 * 2. Con evidencia, el umbral de confianza decide.
 */
function decideStatus(
  insight: GeneratedInsight,
  score: number,
): InsightStatus {
  if (insight.evidence.length === 0) {
    return "rejected";
  }

  return score >= VALIDATION_CONFIDENCE_THRESHOLD ? "validated" : "rejected";
}

/**
 * Determinista y sin llamadas a IA a propósito — misma disciplina que
 * `DeterministicClassifyStage` y `DeterministicMemoryRankingStrategy`
 * de M2: correcta hoy, mejor mañana, nunca engañosa sobre lo que hace.
 * Implementa `InsightValidationStrategy` como cualquier otra
 * estrategia: sustituirla después (reglas explícitas más ricas,
 * intervención humana, o un motor inteligente) es escribir otra clase
 * que implemente el mismo contrato — ningún llamador se entera.
 *
 * Nunca lee `context`: decidir si una propuesta es confiable depende
 * de la propuesta misma (su confianza, su evidencia), nunca de quién
 * es la persona — misma disciplina que `personId` nunca influye en
 * `DeterministicMemoryRankingStrategy` ni en `DeterministicClassifyStage`.
 *
 * Preserva el arreglo completo de entrada a salida (uno a uno, sin
 * filtrar) — decidir qué se persiste de lo rechazado es
 * responsabilidad de `PersistStage`, no de esta clase.
 */
export class DeterministicInsightValidationStrategy
  implements InsightValidationStrategy
{
  async validate(
    insights: GeneratedInsight[],
    _context: PipelineContext,
  ): Promise<ValidatedInsight[]> {
    const assignedAt = new Date();

    return insights.map((insight) => {
      const score = clampScore(insight.proposedConfidence);
      const confidence: Confidence = { score, assignedAt };
      const status = decideStatus(insight, score);

      return {
        ...insight,
        confidence,
        status,
      };
    });
  }
}
