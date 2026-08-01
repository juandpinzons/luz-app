import type { ContinuityLoop, LoopEvidence } from "../domain/continuity-loop";
import type { LoopPriority } from "../domain/loop-priority";

/** Horas base de espera por prioridad -- misión: "No random scheduling. No spam. Cooldowns must exist." Valores de producto (más urgente, más seguido), ajustables sin tocar la lógica. */
const BASE_COOLDOWN_HOURS: Readonly<Record<LoopPriority, number>> = {
  critical: 4,
  high: 24,
  medium: 72,
  low: 168,
};

/** Techo del backoff -- ningún loop espera más de 4x su intervalo base sin importar cuántos intentos ya tuvo, para no degenerar en "nunca más". El límite absoluto de intentos/antigüedad lo impone `detectTimeoutExceeded` (`../resolution/`), no este backoff. */
const MAX_BACKOFF_MULTIPLIER = 4;

const HOUR_MS = 60 * 60 * 1000;

export interface ScheduleNextFollowUpInput {
  readonly loop: ContinuityLoop;
  readonly now?: Date;
  /**
   * Fecha real ancla -- misión: "Calendar should influence timing".
   * Cuando está presente y es futura, DEFINE el próximo seguimiento
   * directamente (p. ej. la hora de un `CalendarEvent`, o
   * `Goal.targetDate`), con precedencia total sobre el cooldown
   * genérico -- una fecha real siempre le gana a una estimación. Si es
   * pasada o ausente, se usa el cooldown por prioridad/backoff.
   */
  readonly anchorDate?: Date;
}

/**
 * Calcula CUÁNDO debería este loop volver a ser elegible para
 * seguimiento -- pura, determinista, sin aleatoriedad (misión: "No
 * random scheduling"). `loop.priority` decide el intervalo base
 * (misión: "Experience Intelligence should influence priority" -- la
 * urgencia de Experience ya se resume en `priority` al crear/actualizar
 * el loop, este scheduler nunca vuelve a leer `PresenceUrgencyLevel`
 * directamente, mantiene la dirección de dependencia `core/` correcta).
 * `loop.followUpAttempts` decide el backoff -- cada intento sin
 * resolverse espacia más el siguiente, nunca insiste al mismo ritmo
 * (misión: "No spam").
 */
export function scheduleNextFollowUp(input: ScheduleNextFollowUpInput): Date {
  const now = input.now ?? new Date();

  if (input.anchorDate && input.anchorDate.getTime() > now.getTime()) {
    return input.anchorDate;
  }

  const baseHours = BASE_COOLDOWN_HOURS[input.loop.priority];
  const backoffMultiplier = Math.min(input.loop.followUpAttempts + 1, MAX_BACKOFF_MULTIPLIER);

  return new Date(now.getTime() + baseHours * backoffMultiplier * HOUR_MS);
}

/** Evidencia que justifica `open`/`follow_up` -> `waiting` -- la fecha real que `scheduleNextFollowUp` acaba de calcular. Se pasa a `transitionLoop(loop, "waiting", evidencia, {nextFollowUpAt})`. */
export function followUpScheduledEvidence(nextFollowUpAt: Date, now: Date = new Date()): LoopEvidence {
  return {
    kind: "follow_up_scheduled",
    observedAt: now,
    description: `Próximo seguimiento programado para ${nextFollowUpAt.toISOString()}.`,
  };
}

/** Evidencia que justifica `waiting` -> `follow_up` -- la fecha programada ya se cumplió. Se pasa a `transitionLoop(loop, "follow_up", evidencia)`. */
export function followUpDueEvidence(loop: ContinuityLoop, now: Date = new Date()): LoopEvidence {
  return {
    kind: "follow_up_due",
    observedAt: now,
    description: `El seguimiento programado para ${loop.nextFollowUpAt?.toISOString() ?? "una fecha ya pasada"} se cumplió.`,
  };
}
