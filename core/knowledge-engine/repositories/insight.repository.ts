import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { Evidence } from "../entities/evidence";
import type { Insight } from "../entities/insight";
import type { InsightRelationship } from "../entities/insight-relationship";

/**
 * Solo persiste y recupera — misma disciplina que `MemoryRepository`
 * y `LifeGraphRepository`. Orquestar el pipeline (Extract→Persist) es
 * responsabilidad de `engine/knowledge-engine.ts`, no de este archivo.
 *
 * `save()` recibe el `Insight` completo (incluido `id`) a propósito —
 * mismo patrón "upsert" que `MemoryRepository.save()`: no asume que un
 * insight sea inmutable. Actualizar la confianza, la descripción, o el
 * `status` (invalidar, y algún día archivar) es simplemente volver a
 * llamar `save()` con el campo cambiado — ningún método nuevo hace
 * falta para ese ciclo de vida. `delete()` es para remoción real
 * (ej. error de extracción, solicitud de borrado), no el mecanismo para
 * invalidar o archivar: mismo criterio que Memory ya estableció para
 * "forget" (`status: "forgotten"`, nunca un `DELETE`, para preservar la
 * historia) — preservar cuándo LUZ entendió algo, y cuándo dejó de
 * confiar en ello, importa tanto como el conocimiento mismo.
 */
export interface InsightRepository {
  getById(context: LifeGraphContext, id: EntityId): Promise<Insight | null>;
  list(context: LifeGraphContext): Promise<Insight[]>;
  save(context: LifeGraphContext, insight: Insight): Promise<Insight>;
  delete(context: LifeGraphContext, id: EntityId): Promise<void>;
  getEvidence(
    context: LifeGraphContext,
    insightId: EntityId,
  ): Promise<Evidence[]>;
  saveEvidence(
    context: LifeGraphContext,
    evidence: Evidence,
  ): Promise<Evidence>;
  getRelationships(
    context: LifeGraphContext,
    insightId: EntityId,
  ): Promise<InsightRelationship[]>;
  saveRelationship(
    context: LifeGraphContext,
    relationship: InsightRelationship,
  ): Promise<InsightRelationship>;
}
