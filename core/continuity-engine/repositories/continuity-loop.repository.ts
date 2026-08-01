import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { ContinuityLoop, LoopTransitionRecord } from "../domain/continuity-loop";
import type { LoopState } from "../domain/loop-state";

/**
 * Puerto de persistencia de `ContinuityLoop` -- mismo contrato de
 * capas que el resto de `core/*-engine` (`BeliefRepository`,
 * `InsightRepository`, ...): `application`/`detection`/`resolution`
 * dependen SOLO de esta interfaz, nunca de `DrizzleContinuityLoopRepository`
 * directamente.
 */
export interface ContinuityLoopRepository {
  getById(context: LifeGraphContext, id: EntityId): Promise<ContinuityLoop | null>;
  list(context: LifeGraphContext): Promise<ContinuityLoop[]>;
  /** Loops en cualquiera de los estados dados -- p. ej. `["open","waiting","follow_up"]` para "todo lo no terminal". */
  listByState(context: LifeGraphContext, states: readonly LoopState[]): Promise<ContinuityLoop[]>;
  /** Loops en `waiting` cuyo `nextFollowUpAt` ya se cumplió -- el "reloj" de Continuity, ver `../scheduling/`. Nunca incluye loops sin `nextFollowUpAt` ni loops ya en `follow_up`/terminales. */
  listDueForFollowUp(context: LifeGraphContext, now: Date): Promise<ContinuityLoop[]>;
  /** Upsert por `id`. Mismo criterio que `DrizzleBeliefRepository.save`: rechaza (lanza) si `loop.lifeGraphId !== context.lifeGraphId`, nunca corrige en silencio. */
  save(context: LifeGraphContext, loop: ContinuityLoop): Promise<ContinuityLoop>;
  getHistory(context: LifeGraphContext, loopId: EntityId): Promise<LoopTransitionRecord[]>;
  appendTransition(context: LifeGraphContext, record: LoopTransitionRecord): Promise<LoopTransitionRecord>;
}
