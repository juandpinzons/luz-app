import type { Relationship } from "../../life";
import type { ContinuityLoop } from "../domain/continuity-loop";
import type { LoopClosureResult } from "./loop-closure-result";

/**
 * Regla de cierre determinista para `Relationship` -- misión ejemplo
 * "relationship updated". Dispara cuando `relationship.updatedAt` es
 * posterior a `loop.trigger.detectedAt` -- la fila real se tocó
 * DESPUÉS de que el aniversario abrió el loop, evidencia estructural
 * de que la persona hizo algo con esa relación (notas, cercanía, tipo),
 * nunca contenido interpretado.
 */
export function detectRelationshipClosure(
  loop: ContinuityLoop,
  relationship: Relationship,
  now: Date = new Date(),
): LoopClosureResult | null {
  if (loop.trigger.origin !== "relationship" || loop.trigger.sourceId !== relationship.id) return null;
  if (relationship.updatedAt.getTime() <= loop.trigger.detectedAt.getTime()) return null;

  return {
    evidence: {
      kind: "relationship_updated",
      observedAt: now,
      description: "La relación se actualizó después de que este loop se abrió.",
      sourceId: relationship.id,
    },
    toState: "resolved",
    outcome: { kind: "positive", summary: "La relación se actualizó tras el aniversario.", capturedAt: now },
  };
}
