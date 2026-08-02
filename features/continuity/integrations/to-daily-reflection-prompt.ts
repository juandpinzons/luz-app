import type { ContinuityLoop } from "../../../core/continuity-engine";

/**
 * "Daily Reflection" no existe todavía como superficie de producto en
 * este repo (verificado: cero módulo `features/` con ese nombre) --
 * este contrato es puramente prospectivo (misión: "Expose clean
 * contracts for... Daily Reflection"), sin nada real que envolver
 * todavía. Plantilla fija + datos reales, nunca texto generado por IA
 * (mismo criterio que `LifeObservation.explanation`) -- si un futuro
 * Daily Reflection quiere prosa más rica, la construye él mismo a
 * partir de estos campos, este contrato solo garantiza los datos.
 */
export interface DailyReflectionPrompt {
  readonly loopId: string;
  readonly prompt: string;
  readonly relatedTitle: string;
}

/**
 * Un prompt por cada loop en `follow_up` -- exactamente los que ya
 * están listos para que LUZ pregunte "¿cómo va esto?" (ver
 * `LoopState.follow_up`). Nunca para `open`/`waiting` (todavía no les
 * toca) ni terminales (ya no hay nada que reflexionar).
 */
export function buildDailyReflectionPrompts(loopsInFollowUp: readonly ContinuityLoop[]): DailyReflectionPrompt[] {
  return loopsInFollowUp
    .filter((loop) => loop.state === "follow_up")
    .map((loop) => ({
      loopId: loop.id,
      prompt: `¿Cómo va esto: "${loop.title}"?`,
      relatedTitle: loop.title,
    }));
}
