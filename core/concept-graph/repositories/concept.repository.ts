import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { ConceptEvidence } from "../entities/concept-evidence";
import type { ConceptRelation } from "../entities/concept-relation";
import type { Concept } from "../entities/concept";

/**
 * Solo persiste y recupera — misma disciplina que `InsightRepository`.
 * `save()` es upsert (mismo criterio: un Concept no es inmutable,
 * afinar su `description`/`domain` es volver a llamar `save()`).
 */
export interface ConceptRepository {
  getById(context: LifeGraphContext, id: EntityId): Promise<Concept | null>;
  /** Búsqueda por etiqueta (case-insensitive) — usada para deduplicar antes de crear. */
  getByLabel(context: LifeGraphContext, label: string): Promise<Concept | null>;
  list(context: LifeGraphContext): Promise<Concept[]>;
  save(context: LifeGraphContext, concept: Concept): Promise<Concept>;

  listRelations(
    context: LifeGraphContext,
    conceptId: EntityId,
  ): Promise<ConceptRelation[]>;
  saveRelation(
    context: LifeGraphContext,
    relation: ConceptRelation,
  ): Promise<ConceptRelation>;

  listEvidence(
    context: LifeGraphContext,
    conceptId: EntityId,
  ): Promise<ConceptEvidence[]>;
  saveEvidence(
    context: LifeGraphContext,
    evidence: ConceptEvidence,
  ): Promise<ConceptEvidence>;
}
