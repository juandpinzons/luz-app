import type { CuriosityQuestion } from "../../curiosity-engine";
import type { ContinuityLoop } from "../domain/continuity-loop";
import type { LoopClosureResult } from "./loop-closure-result";

/**
 * Regla de cierre determinista para `CuriosityQuestion` -- misión
 * ejemplo "user answered follow-up" (resuelta) / abandono explícito
 * (descartada). Reutiliza el `status` que `core/curiosity-engine` ya
 * decidió (`resolveStaleCuriosityQuestions`), nunca reinterpreta si la
 * pregunta "de verdad" se respondió.
 */
export function detectCuriosityClosure(
  loop: ContinuityLoop,
  question: CuriosityQuestion,
  now: Date = new Date(),
): LoopClosureResult | null {
  if (loop.trigger.origin !== "curiosity" || loop.trigger.sourceId !== question.id) return null;
  if (question.status === "pending") return null;

  if (question.status === "resolved") {
    return {
      evidence: {
        kind: "curiosity_resolved",
        observedAt: now,
        description: "La pregunta de curiosidad se resolvió.",
        sourceId: question.id,
      },
      toState: "resolved",
      outcome: { kind: "positive", summary: "LUZ entendió mejor este dominio.", capturedAt: now },
    };
  }

  return {
    evidence: {
      kind: "curiosity_resolved",
      observedAt: now,
      description: "La pregunta de curiosidad se descartó.",
      sourceId: question.id,
    },
    toState: "abandoned",
  };
}
