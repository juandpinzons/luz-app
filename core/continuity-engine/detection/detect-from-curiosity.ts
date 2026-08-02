import type { CuriosityQuestion } from "../../curiosity-engine";
import type { DetectedLoopCandidate } from "./detected-loop-candidate";

/**
 * Regla de apertura determinista para `CuriosityQuestion` -- misión
 * ejemplo "question requiring future answer". LUZ ya decidió, con su
 * propia disciplina (`core/curiosity-engine`, a lo sumo una `pending`
 * por LifeGraph), que esta pregunta merece hacerse -- Continuity no
 * repite ese juicio, solo evita que se pierda una vez ofrecida.
 * Prioridad `low` a propósito: curiosidad es exploratoria, nunca tan
 * urgente como una reunión o un plazo real.
 */
export function detectFromCuriosityQuestion(
  question: CuriosityQuestion,
  now: Date = new Date(),
): DetectedLoopCandidate | null {
  if (question.status !== "pending") return null;

  return {
    trigger: {
      origin: "curiosity",
      reason: "question_pending_answer",
      sourceId: question.id,
      detectedAt: now,
      summary: question.question,
    },
    title: question.question,
    priority: "low",
    relatedEntities: [{ kind: "curiosity_question", id: question.id, title: question.question }],
  };
}
