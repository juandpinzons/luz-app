import type { LifeGraphContext } from "../../../life/life-graph-context";
import type { EntityId } from "../../../life/value-objects/entity-id";
import type { ReasoningConclusion } from "../entities/reasoning-conclusion";
import type { ReasoningEvidence, ReasoningEvidenceRef } from "../entities/reasoning-evidence";

/**
 * Solo persiste y recupera -- misma disciplina que `InsightRepository`.
 * `save()` es upsert: invalidar una conclusión (`status: "invalidated"`,
 * Principio 4) es volver a llamar `save()` con el campo cambiado,
 * ningún método nuevo por transición de estado.
 */
export interface ReasoningRepository {
  getById(context: LifeGraphContext, id: EntityId): Promise<ReasoningConclusion | null>;
  list(context: LifeGraphContext): Promise<ReasoningConclusion[]>;
  save(
    context: LifeGraphContext,
    conclusion: ReasoningConclusion,
  ): Promise<ReasoningConclusion>;

  getEvidence(
    context: LifeGraphContext,
    conclusionId: EntityId,
  ): Promise<ReasoningEvidence[]>;
  saveEvidence(
    context: LifeGraphContext,
    conclusionId: EntityId,
    ref: ReasoningEvidenceRef,
  ): Promise<ReasoningEvidence>;

  /** Conclusiones donde este ref (insight, memoria, y a futuro belief/concepto) participó como evidencia -- "qué se concluyó a partir de esto". */
  listByEvidenceRef(
    context: LifeGraphContext,
    refType: string,
    refId: EntityId,
  ): Promise<ReasoningConclusion[]>;
}
