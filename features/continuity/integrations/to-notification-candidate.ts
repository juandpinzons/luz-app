import type { ContinuityLoop, LoopPriority } from "../../../core/continuity-engine";

/**
 * La capa de notificaciones no existe todavía en este repo (misión:
 * "Future Notification Layer") -- este contrato es prospectivo, mismo
 * criterio que `to-daily-reflection-prompt.ts`. Deliberadamente NO
 * decide canal (push/email/in-app) ni copy final -- solo qué loop
 * amerita una notificación y con qué prioridad, datos que cualquier
 * canal futuro necesitaría de todas formas.
 */
export interface ContinuityNotificationCandidate {
  readonly loopId: string;
  readonly priority: LoopPriority;
  readonly title: string;
  readonly message: string;
}

/**
 * Solo loops YA elegibles para seguimiento (`follow_up`) con prioridad
 * `high`/`critical` -- misión: "No spam" aplica también aquí, con más
 * fuerza que en Daily Reflection (una notificación interrumpe activamente,
 * un prompt en la app no). `medium`/`low` nunca generan una candidata de
 * notificación en esta fase -- quedan disponibles para Dashboard/Daily
 * Reflection, que son medios menos intrusivos.
 */
export function toNotificationCandidates(loopsInFollowUp: readonly ContinuityLoop[]): ContinuityNotificationCandidate[] {
  return loopsInFollowUp
    .filter((loop) => loop.state === "follow_up" && (loop.priority === "high" || loop.priority === "critical"))
    .map((loop) => ({
      loopId: loop.id,
      priority: loop.priority,
      title: loop.title,
      message: loop.trigger.summary,
    }));
}
