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
  /** Igual que `list()` filtrado a `status: "active"`, pero resuelto en SQL -- evita hidratar creencias expiradas/retractadas solo para descartarlas en JS (ver `enrich-knowledge-graph.ts`). */
  listActive(context: LifeGraphContext): Promise<Belief[]>;
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
  /** Igual que llamar `getHistory()` por cada id, pero en una sola consulta (`inArray`) -- evita N ida-y-vueltas secuenciales cuando el llamador ya tiene varias creencias en mano (ver `describe-evolution.ts`/`collect-domain-movements.ts`). Orden cronológico ascendente dentro de cada `beliefId`, pero sin garantía de orden entre distintos `beliefId` -- el llamador ya agrupa por `beliefId` si lo necesita. */
  getHistoryForBeliefs(
    context: LifeGraphContext,
    beliefIds: readonly EntityId[],
  ): Promise<BeliefHistoryEntry[]>;
  appendHistory(
    context: LifeGraphContext,
    entry: BeliefHistoryEntry,
  ): Promise<BeliefHistoryEntry>;

  /**
   * Igual que llamar `save()` seguido de `appendHistory()`, pero en una
   * sola transacción -- ver `decay-stale-beliefs.ts`: sin esto, una
   * caída entre ambas escrituras deja un Belief con confianza ya
   * decayida pero ninguna fila de historial que lo explique (Principio
   * 3, explicabilidad). Cualquier cambio de confianza que deba quedar
   * auditado en el mismo instante en que se aplica usa este método, no
   * las dos llamadas por separado.
   */
  saveWithHistory(
    context: LifeGraphContext,
    belief: Belief,
    entry: BeliefHistoryEntry,
  ): Promise<Belief>;
}
