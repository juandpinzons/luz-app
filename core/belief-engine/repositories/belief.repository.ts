import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { BeliefEvidence } from "../entities/belief-evidence";
import type { BeliefHistoryEntry } from "../entities/belief-history-entry";
import type { Belief } from "../entities/belief";

/**
 * Solo persiste y recupera -- misma disciplina que `InsightRepository`.
 * `save()` es upsert: reforzar/debilitar/expirar/retractar un Belief es
 * volver a llamar `save()` con el `status`/`confidence` cambiado, nunca
 * un método nuevo por transición de estado.
 */
export interface BeliefRepository {
  getById(context: LifeGraphContext, id: EntityId): Promise<Belief | null>;
  list(context: LifeGraphContext): Promise<Belief[]>;
  save(context: LifeGraphContext, belief: Belief): Promise<Belief>;

  getEvidence(context: LifeGraphContext, beliefId: EntityId): Promise<BeliefEvidence[]>;
  saveEvidence(
    context: LifeGraphContext,
    evidence: BeliefEvidence,
  ): Promise<BeliefEvidence>;

  /** Orden cronológico ascendente -- primera fila es la creación. */
  getHistory(
    context: LifeGraphContext,
    beliefId: EntityId,
  ): Promise<BeliefHistoryEntry[]>;
  appendHistory(
    context: LifeGraphContext,
    entry: BeliefHistoryEntry,
  ): Promise<BeliefHistoryEntry>;
}
