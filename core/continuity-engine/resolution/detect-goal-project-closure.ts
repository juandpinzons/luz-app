import type { Goal, Project } from "../../life";
import type { ContinuityLoop } from "../domain/continuity-loop";
import type { LoopClosureResult } from "./loop-closure-result";

/**
 * Regla de cierre determinista para `Goal` -- misión ejemplo "goal
 * completed". Solo aplica a un loop cuyo `trigger.origin === "goal"` y
 * cuyo `trigger.sourceId` sea este mismo Goal -- nunca cierra un loop
 * de otro origen por casualidad de nombres.
 *
 * `"completed"` -> `resolved` con `LoopOutcome` positivo (el desenlace
 * real que la misión pide, nunca un cierre silencioso).
 * `"abandoned"` -> `abandoned` -- el propio Goal ya registró que la
 * persona lo dejó, evidencia real, no inferida.
 * `"active"`/`"paused"` no cierran nada -- siguen en curso.
 */
export function detectGoalClosure(loop: ContinuityLoop, goal: Goal, now: Date = new Date()): LoopClosureResult | null {
  if (loop.trigger.origin !== "goal" || loop.trigger.sourceId !== goal.id) return null;

  if (goal.status === "completed") {
    return {
      evidence: {
        kind: "goal_or_project_status_changed",
        observedAt: now,
        description: `El Goal "${goal.title}" se completó.`,
        sourceId: goal.id,
      },
      toState: "resolved",
      outcome: { kind: "positive", summary: `"${goal.title}" se completó.`, capturedAt: now },
    };
  }

  if (goal.status === "abandoned") {
    return {
      evidence: {
        kind: "goal_or_project_status_changed",
        observedAt: now,
        description: `El Goal "${goal.title}" se marcó como abandonado.`,
        sourceId: goal.id,
      },
      toState: "abandoned",
    };
  }

  return null;
}

/** Mismo criterio que `detectGoalClosure`, para `Project` (`"completed"`/`"cancelled"`). */
export function detectProjectClosure(
  loop: ContinuityLoop,
  project: Project,
  now: Date = new Date(),
): LoopClosureResult | null {
  if (loop.trigger.origin !== "project" || loop.trigger.sourceId !== project.id) return null;

  if (project.status === "completed") {
    return {
      evidence: {
        kind: "goal_or_project_status_changed",
        observedAt: now,
        description: `El Project "${project.title}" se completó.`,
        sourceId: project.id,
      },
      toState: "resolved",
      outcome: { kind: "positive", summary: `"${project.title}" se completó.`, capturedAt: now },
    };
  }

  if (project.status === "cancelled") {
    return {
      evidence: {
        kind: "goal_or_project_status_changed",
        observedAt: now,
        description: `El Project "${project.title}" se canceló.`,
        sourceId: project.id,
      },
      toState: "abandoned",
    };
  }

  return null;
}
