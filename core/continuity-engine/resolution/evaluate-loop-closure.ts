import type { CuriosityQuestion } from "../../curiosity-engine";
import type { Goal, Project, Relationship } from "../../life";
import type { Memory } from "../../memory-engine";
import type { ContinuityLoop } from "../domain/continuity-loop";
import { isTerminalLoopState } from "../domain/loop-state";
import { detectCuriosityClosure } from "./detect-curiosity-closure";
import { detectGoalClosure, detectProjectClosure } from "./detect-goal-project-closure";
import { detectMemoryClosure } from "./detect-memory-closure";
import { detectRelationshipClosure } from "./detect-relationship-closure";
import { detectTimeoutExceeded } from "./detect-timeout-exceeded";
import type { LoopClosureResult } from "./loop-closure-result";

/** Fuentes puramente `core/` -- Calendar/Gmail viven en `features/continuity/resolution/`, con su propio orquestador que envuelve este (ver `../README.md`). */
export interface EvaluateLoopClosureInput {
  readonly loop: ContinuityLoop;
  readonly goal?: Goal;
  readonly project?: Project;
  readonly relationship?: Relationship;
  readonly memory?: Memory;
  readonly curiosityQuestion?: CuriosityQuestion;
  readonly now?: Date;
}

/**
 * Prueba cada regla de cierre aplicable a `loop.trigger.origin`, en
 * orden: evidencia real y específica del origen SIEMPRE antes que
 * `timeout_exceeded` (el último recurso) -- si algo real ya justifica
 * un cierre, el sistema nunca debe reportar "nos rendimos" en su
 * lugar. `null` si nada justifica un cierre todavía -- el loop sigue
 * como está, nunca se fuerza una transición sin evidencia (misión:
 * "Never close a loop automatically without justification").
 */
export function evaluateLoopClosure(input: EvaluateLoopClosureInput): LoopClosureResult | null {
  const now = input.now ?? new Date();
  if (isTerminalLoopState(input.loop.state)) return null;

  if (input.goal) {
    const result = detectGoalClosure(input.loop, input.goal, now);
    if (result) return result;
  }
  if (input.project) {
    const result = detectProjectClosure(input.loop, input.project, now);
    if (result) return result;
  }
  if (input.relationship) {
    const result = detectRelationshipClosure(input.loop, input.relationship, now);
    if (result) return result;
  }
  if (input.memory) {
    const result = detectMemoryClosure(input.loop, input.memory, now);
    if (result) return result;
  }
  if (input.curiosityQuestion) {
    const result = detectCuriosityClosure(input.loop, input.curiosityQuestion, now);
    if (result) return result;
  }

  return detectTimeoutExceeded(input.loop, now);
}
