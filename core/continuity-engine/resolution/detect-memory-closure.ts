import type { Memory } from "../../memory-engine";
import type { ContinuityLoop } from "../domain/continuity-loop";
import type { LoopClosureResult } from "./loop-closure-result";

/**
 * Regla de cierre determinista para `Memory` -- misión ejemplo "memory
 * superseded". Dispara cuando la Memory que originó el loop ya no está
 * `"active"` (`"archived"`/`"forgotten"`) -- el propio Memory Engine ya
 * decidió que esta evidencia dejó de ser vigente, Continuity solo deja
 * de rastrear en consecuencia.
 *
 * Cierra en `archived`, NUNCA `resolved` -- que la memoria original se
 * haya archivado/olvidado no confirma ningún desenlace real de la
 * intención/evento que describía, solo que el sistema dejó de
 * considerarla evidencia vigente. Afirmar `resolved` aquí sería
 * inventar un éxito que nadie confirmó.
 */
export function detectMemoryClosure(
  loop: ContinuityLoop,
  memory: Memory,
  now: Date = new Date(),
): LoopClosureResult | null {
  if (loop.trigger.origin !== "memory" || loop.trigger.sourceId !== memory.id) return null;
  if (memory.status === "active") return null;

  return {
    evidence: {
      kind: "memory_superseded",
      observedAt: now,
      description: `La memoria original pasó a estado "${memory.status}".`,
      sourceId: memory.id,
    },
    toState: "archived",
  };
}
