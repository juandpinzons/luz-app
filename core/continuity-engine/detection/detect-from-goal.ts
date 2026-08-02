import type { Goal } from "../../life";
import type { DetectedLoopCandidate } from "./detected-loop-candidate";

/** Ventana de alerta -- misión ejemplo "deadline". 14 días es un valor de producto (dos semanas de aviso real), ajustable sin tocar la regla. */
export const GOAL_DEADLINE_WINDOW_DAYS = 14;
/** Dentro de esta ventana más corta, la prioridad sube de `medium` a `high` -- "ya casi es". */
export const GOAL_DEADLINE_URGENT_DAYS = 3;

function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Regla de apertura determinista para `Goal` -- misión ejemplo
 * "deadline". Solo `status === "active"` con `targetDate` dentro de
 * `GOAL_DEADLINE_WINDOW_DAYS` días -- nunca un Goal ya vencido (eso es
 * responsabilidad de una regla de cierre/incumplimiento, no de
 * apertura, ver `../resolution/`) ni uno sin fecha (nada que vigilar).
 */
export function detectGoalDeadline(goal: Goal, now: Date = new Date()): DetectedLoopCandidate | null {
  if (goal.status !== "active") return null;
  if (!goal.targetDate) return null;

  const days = daysUntil(goal.targetDate, now);
  if (days < 0 || days > GOAL_DEADLINE_WINDOW_DAYS) return null;

  return {
    trigger: {
      origin: "goal",
      reason: "deadline",
      sourceId: goal.id,
      detectedAt: now,
      summary: `${goal.title} -- fecha objetivo en ${days} día(s)`,
    },
    title: goal.title,
    priority: days <= GOAL_DEADLINE_URGENT_DAYS ? "high" : "medium",
    relatedEntities: [{ kind: "goal", id: goal.id, title: goal.title }],
  };
}
