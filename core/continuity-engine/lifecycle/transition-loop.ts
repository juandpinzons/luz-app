import { createEntityId, type EntityId } from "../../life/value-objects/entity-id";
import {
  type ContinuityLoop,
  type LoopEvidence,
  type LoopOutcome,
  type LoopRelatedEntity,
  type LoopResolution,
  type LoopTrigger,
} from "../domain/continuity-loop";
import { isAllowedLoopTransition, isTerminalLoopState, type LoopState } from "../domain/loop-state";
import type { LoopPriority } from "../domain/loop-priority";

export interface CreateContinuityLoopInput {
  readonly lifeGraphId: EntityId;
  readonly trigger: LoopTrigger;
  readonly title: string;
  readonly priority: LoopPriority;
  readonly relatedEntities: readonly LoopRelatedEntity[];
  readonly now?: Date;
}

/**
 * Único punto de creación de un `ContinuityLoop` -- siempre nace en
 * `state: "open"`, sin evidencia, sin próximo seguimiento (eso lo
 * decide `scheduleNextFollowUp`, `../scheduling/`, en un paso
 * separado). Pura, sin I/O -- el llamador decide cómo y dónde
 * persistir (mismo patrón que `connectCalendar`/`connectGmail`,
 * `features/reality/application/`).
 */
export function createContinuityLoop(input: CreateContinuityLoopInput): ContinuityLoop {
  const now = input.now ?? new Date();

  return {
    id: createEntityId(crypto.randomUUID()),
    lifeGraphId: input.lifeGraphId,
    trigger: input.trigger,
    title: input.title,
    state: "open",
    priority: input.priority,
    resolution: undefined,
    nextFollowUpAt: undefined,
    followUpAttempts: 0,
    relatedEntities: input.relatedEntities,
    createdAt: now,
    updatedAt: now,
  };
}

export interface TransitionLoopInput {
  readonly loop: ContinuityLoop;
  readonly toState: LoopState;
  /** Siempre obligatoria -- misión: "Every transition must require evidence." No existe una sobrecarga de esta función que la omita. */
  readonly evidence: LoopEvidence;
  /** Obligatorio cuando `toState === "waiting"` -- nunca una espera sin fecha real. Ver `../scheduling/schedule-next-follow-up.ts`. */
  readonly nextFollowUpAt?: Date;
  /** Obligatorio cuando `toState === "resolved"` -- nunca un cierre con éxito/fracaso implícito. */
  readonly outcome?: LoopOutcome;
  /** Obligatorio cuando `toState === "transformed"` -- nunca se pierde la trazabilidad de hacia dónde se transformó. */
  readonly transformedIntoLoopId?: EntityId;
  readonly now?: Date;
}

/**
 * El único código de todo el módulo que decide si una transición de
 * estado es válida y la aplica -- ningún otro archivo debe construir
 * un `ContinuityLoop` con `state` modificado a mano. Lanza (nunca
 * devuelve un estado inconsistente en silencio) si:
 * - la transición no está en `LOOP_ALLOWED_TRANSITIONS` (incluye
 *   intentar "transicionar" a un estado terminal ya alcanzado, o
 *   saltarse un estado no permitido),
 * - `toState === "waiting"` sin `nextFollowUpAt`,
 * - `toState === "resolved"` sin `outcome`,
 * - `toState === "transformed"` sin `transformedIntoLoopId`.
 *
 * Pura, sin I/O. `followUpAttempts` se incrementa únicamente al ENTRAR
 * a `follow_up` (no cada vez que un consumidor externo lo muestra) --
 * cuenta cuántas veces este loop llegó a ser elegible para seguimiento
 * sin resolverse, la señal que `scheduleNextFollowUp` usa para el
 * backoff y que la regla `timeout_exceeded` (`../resolution/`) usa
 * para el límite máximo.
 */
export function transitionLoop(input: TransitionLoopInput): ContinuityLoop {
  const { loop, toState, evidence } = input;
  const now = input.now ?? new Date();

  if (!isAllowedLoopTransition(loop.state, toState)) {
    throw new Error(
      `transitionLoop: transición inválida "${loop.state}" -> "${toState}" para el loop ${loop.id} -- ver LOOP_ALLOWED_TRANSITIONS.`,
    );
  }

  if (isTerminalLoopState(toState)) {
    if (toState === "resolved" && !input.outcome) {
      throw new Error(
        `transitionLoop: toState "resolved" exige un LoopOutcome (loop ${loop.id}) -- nunca se cierra con éxito/fracaso implícito.`,
      );
    }
    if (toState === "transformed" && !input.transformedIntoLoopId) {
      throw new Error(
        `transitionLoop: toState "transformed" exige transformedIntoLoopId (loop ${loop.id}) -- nunca se pierde la trazabilidad de hacia dónde se transformó.`,
      );
    }

    const resolution: LoopResolution = {
      state: toState,
      resolvedAt: now,
      evidence,
      outcome: toState === "resolved" ? input.outcome : undefined,
      transformedIntoLoopId: toState === "transformed" ? input.transformedIntoLoopId : undefined,
    };

    return {
      ...loop,
      state: toState,
      resolution,
      nextFollowUpAt: undefined,
      updatedAt: now,
    };
  }

  if (toState === "waiting" && !input.nextFollowUpAt) {
    throw new Error(
      `transitionLoop: toState "waiting" exige nextFollowUpAt (loop ${loop.id}) -- nunca una espera sin fecha real.`,
    );
  }

  return {
    ...loop,
    state: toState,
    nextFollowUpAt: toState === "waiting" ? input.nextFollowUpAt : undefined,
    followUpAttempts: toState === "follow_up" ? loop.followUpAttempts + 1 : loop.followUpAttempts,
    updatedAt: now,
  };
}
