import {
  detectCuriosityClosure,
  detectGoalClosure,
  detectMemoryClosure,
  detectProjectClosure,
  detectRelationshipClosure,
  detectTimeoutExceeded,
  isTerminalLoopState,
  type ContinuityLoop,
  type LoopClosureResult,
  type LoopEvidence,
} from "../../../core/continuity-engine";
import type { CuriosityQuestion } from "../../../core/curiosity-engine";
import type { Goal, Project, Relationship } from "../../../core/life";
import type { Memory } from "../../../core/memory-engine";
import type { CalendarEvent, EmailSnapshot } from "../../reality/domain";
import { calendarEventPassedEvidence, detectCalendarEventClosure } from "./detect-calendar-closure";
import { detectEmailClosure } from "./detect-email-closure";

export interface EvaluateAllLoopClosureInput {
  readonly loop: ContinuityLoop;
  readonly goal?: Goal;
  readonly project?: Project;
  readonly relationship?: Relationship;
  readonly memory?: Memory;
  readonly curiosityQuestion?: CuriosityQuestion;
  readonly emailSnapshot?: EmailSnapshot;
  readonly calendarEvent?: CalendarEvent;
  /** Solo relevante junto con `calendarEvent` -- ver `detectCalendarEventClosure`. */
  readonly memoriesSinceCalendarEventEnded?: readonly Memory[];
  readonly now?: Date;
}

export type EvaluateAllLoopClosureOutcome =
  | { readonly kind: "close"; readonly result: LoopClosureResult }
  /** El evento de calendario ya pasó pero todavía no hay evidencia de desenlace -- el llamador debe llamar `transitionLoop(loop, "follow_up", evidence, {nextFollowUpAt})`, nunca un estado terminal. */
  | { readonly kind: "await_outcome"; readonly evidence: LoopEvidence }
  | { readonly kind: "none" };

/**
 * Orquestador COMPLETO de cierre -- combina las reglas `core/`
 * (Goal/Project/Relationship/Memory/Curiosity) con las de `features/`
 * (Email/Calendar), en ese orden, y deja `timeout_exceeded` como
 * ÚLTIMO recurso real (nunca antes que una evidencia concreta,
 * incluida la de Calendar/Email) -- por eso este archivo llama a las
 * reglas `core/` UNA POR UNA en vez de reusar
 * `core/continuity-engine`'s `evaluateLoopClosure` completo: ese
 * ya incluye su propio fallback de timeout al final, que aquí
 * necesitábamos aplazar hasta después de Email/Calendar también.
 */
export function evaluateAllLoopClosure(input: EvaluateAllLoopClosureInput): EvaluateAllLoopClosureOutcome {
  const now = input.now ?? new Date();
  if (isTerminalLoopState(input.loop.state)) return { kind: "none" };

  if (input.goal) {
    const result = detectGoalClosure(input.loop, input.goal, now);
    if (result) return { kind: "close", result };
  }
  if (input.project) {
    const result = detectProjectClosure(input.loop, input.project, now);
    if (result) return { kind: "close", result };
  }
  if (input.relationship) {
    const result = detectRelationshipClosure(input.loop, input.relationship, now);
    if (result) return { kind: "close", result };
  }
  if (input.memory) {
    const result = detectMemoryClosure(input.loop, input.memory, now);
    if (result) return { kind: "close", result };
  }
  if (input.curiosityQuestion) {
    const result = detectCuriosityClosure(input.loop, input.curiosityQuestion, now);
    if (result) return { kind: "close", result };
  }
  if (input.emailSnapshot) {
    const result = detectEmailClosure(input.loop, input.emailSnapshot, now);
    if (result) return { kind: "close", result };
  }
  if (input.calendarEvent) {
    const outcome = detectCalendarEventClosure(input.loop, input.calendarEvent, input.memoriesSinceCalendarEventEnded ?? [], now);
    if (outcome.result) return { kind: "close", result: outcome.result };
    if (outcome.eventPassedAwaitingOutcome) {
      return { kind: "await_outcome", evidence: calendarEventPassedEvidence(input.calendarEvent, now) };
    }
  }

  const timeoutResult = detectTimeoutExceeded(input.loop, now);
  return timeoutResult ? { kind: "close", result: timeoutResult } : { kind: "none" };
}
