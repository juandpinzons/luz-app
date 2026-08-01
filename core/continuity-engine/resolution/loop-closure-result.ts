import type { LoopEvidence, LoopOutcome } from "../domain/continuity-loop";
import type { LoopState } from "../domain/loop-state";

/**
 * Lo que una regla de cierre determinista produce -- evidencia +
 * hacia qué estado TERMINAL justifica moverse. `transitionLoop`
 * (`../lifecycle/`) sigue siendo quien aplica el cambio; esto es solo
 * la decisión de la regla, pura, sin efecto todavía.
 */
export interface LoopClosureResult {
  readonly evidence: LoopEvidence;
  readonly toState: LoopState;
  /** Solo presente cuando `toState === "resolved"`. */
  readonly outcome?: LoopOutcome;
}
