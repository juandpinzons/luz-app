import type { ContinuityLoop } from "../domain/continuity-loop";
import type { LoopClosureResult } from "./loop-closure-result";

/** Después de este número de veces en `follow_up` sin resolverse, el sistema deja de insistir -- valor de producto ("no spam", misión), ajustable. */
export const MAX_FOLLOW_UP_ATTEMPTS = 5;
/** Antigüedad máxima absoluta, sin importar cuántos intentos tuvo -- un loop de 90 días sin resolverse ya no es información fresca. */
export const MAX_LOOP_AGE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Única regla de cierre que nunca depende de un origen concreto -- se
 * evalúa para CUALQUIER loop no terminal, como último recurso
 * (`evaluate-loop-closure.ts` la revisa después de las reglas
 * específicas por origen, nunca antes: una evidencia real siempre le
 * gana a "nos rendimos"). Cierra en `archived`, nunca `resolved` ni
 * `abandoned` -- el sistema decidió dejar de rastrear, no confirmó un
 * desenlace ni recibió una señal humana de abandono; misión: "Never
 * close a loop automatically without justification" -- la
 * justificación aquí es el propio límite determinista, documentado y
 * explicable, nunca silencio.
 */
export function detectTimeoutExceeded(loop: ContinuityLoop, now: Date = new Date()): LoopClosureResult | null {
  const ageDays = (now.getTime() - loop.createdAt.getTime()) / DAY_MS;
  const exceededAttempts = loop.followUpAttempts >= MAX_FOLLOW_UP_ATTEMPTS;
  const exceededAge = ageDays >= MAX_LOOP_AGE_DAYS;

  if (!exceededAttempts && !exceededAge) return null;

  const description = exceededAttempts
    ? `Excedió ${MAX_FOLLOW_UP_ATTEMPTS} intentos de seguimiento sin resolverse.`
    : `Excedió ${MAX_LOOP_AGE_DAYS} días de antigüedad sin resolverse.`;

  return {
    evidence: { kind: "timeout_exceeded", observedAt: now, description },
    toState: "archived",
  };
}
