import type { EntityId } from "../../life/value-objects/entity-id";
import type { ContinuityLoop } from "../domain/continuity-loop";
import { isTerminalLoopState } from "../domain/loop-state";

/** Después de cuántos intentos de seguimiento sin evidencia real vale la pena pedirle a Curiosity que pregunte directamente -- antes de eso, Continuity todavía espera que la evidencia llegue sola. */
const MIN_ATTEMPTS_BEFORE_CURIOSITY_REQUEST = 2;

/**
 * Una solicitud estructurada de evidencia -- misión: "Curiosity may
 * request missing evidence". Puramente un contrato de datos: este
 * módulo nunca importa `core/curiosity-engine` ni construye una
 * `CuriosityQuestion` por su cuenta (misión: "Do NOT deeply integrate
 * yet. Expose clean contracts") -- un futuro consumidor decide si y
 * cómo traducir esto en una pregunta real.
 */
export interface CuriosityEvidenceRequest {
  readonly loopId: EntityId;
  readonly rationale: string;
}

/**
 * `null` si el loop no lleva suficientes intentos de seguimiento sin
 * resolverse, o ya es terminal -- nunca genera una solicitud
 * prematura. Determinista: mismo `loop` siempre produce el mismo
 * resultado.
 */
export function requestCuriosityEvidence(loop: ContinuityLoop): CuriosityEvidenceRequest | null {
  if (isTerminalLoopState(loop.state)) return null;
  if (loop.followUpAttempts < MIN_ATTEMPTS_BEFORE_CURIOSITY_REQUEST) return null;

  return {
    loopId: loop.id,
    rationale: `El loop "${loop.title}" lleva ${loop.followUpAttempts} intento(s) de seguimiento sin evidencia real -- Curiosity Engine podría preguntar directamente para conseguirla.`,
  };
}
