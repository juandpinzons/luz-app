import type { Project } from "../../life";
import type { DetectedLoopCandidate } from "./detected-loop-candidate";

/** Mismos valores que `detect-from-goal.ts` a propósito -- una sola política de "qué tan cerca es cerca" para toda la misión "deadline", nunca dos umbrales distintos sin motivo real. */
export const PROJECT_DEADLINE_WINDOW_DAYS = 14;
export const PROJECT_DEADLINE_URGENT_DAYS = 3;

function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Regla de apertura determinista para `Project` -- mismo criterio que
 * `detectGoalDeadline`. `status` elegible: `"active"` o `"planning"`
 * (un proyecto en planeación con fecha límite ya fijada también merece
 * seguimiento) -- nunca `"on_hold"`/`"completed"`/`"cancelled"`.
 */
export function detectProjectDeadline(project: Project, now: Date = new Date()): DetectedLoopCandidate | null {
  if (project.status !== "active" && project.status !== "planning") return null;
  if (!project.dueDate) return null;

  const days = daysUntil(project.dueDate, now);
  if (days < 0 || days > PROJECT_DEADLINE_WINDOW_DAYS) return null;

  return {
    trigger: {
      origin: "project",
      reason: "deadline",
      sourceId: project.id,
      detectedAt: now,
      summary: `${project.title} -- fecha límite en ${days} día(s)`,
    },
    title: project.title,
    priority: days <= PROJECT_DEADLINE_URGENT_DAYS ? "high" : "medium",
    relatedEntities: [{ kind: "project", id: project.id, title: project.title }],
  };
}
