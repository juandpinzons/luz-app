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
  /** Igual que llamar `getById()` por cada id, pero en una sola consulta (`inArray`) -- sin garantía de orden, el llamador reordena si lo necesita (ver `DefaultReasoningGatherStage`). */
  getByIds(context: LifeGraphContext, ids: readonly EntityId[]): Promise<Insight[]>;
  list(context: LifeGraphContext): Promise<Insight[]>;
  /**
   * Insights validados cuya evidencia incluye esta memoria -- usado por
   * `enrich-knowledge-graph.ts` (capa de aplicación) para encontrar,
   * después de una corrida del pipeline, exactamente qué insights nació
   * de la memoria que disparó el job, sin que `DefaultKnowledgeEngine`
   * tenga que devolver ese resultado explícitamente (Extract→Persist no
   * cambia de forma, ver `default-knowledge-engine.ts`).
   */
  listByEvidenceMemoryId(
    context: LifeGraphContext,
    memoryId: EntityId,
  ): Promise<Insight[]>;
  save(context: LifeGraphContext, insight: Insight): Promise<Insight>;
  delete(context: LifeGraphContext, id: EntityId): Promise<void>;
  getEvidence(
    context: LifeGraphContext,
    insightId: EntityId,
  ): Promise<Evidence[]>;
  /** Igual que llamar `getEvidence()` por cada id, pero en una sola consulta (`inArray` sobre `insightId`) -- el llamador agrupa por `insightId` si lo necesita (ver `DefaultInsightConnectStage`/`DefaultReasoningEngine`). */
  getEvidenceForInsights(
    context: LifeGraphContext,
    insightIds: readonly EntityId[],
  ): Promise<Evidence[]>;
  saveEvidence(
    context: LifeGraphContext,
    evidence: Evidence,
  ): Promise<Evidence>;
  getRelationships(
    context: LifeGraphContext,
    insightId: EntityId,
  ): Promise<InsightRelationship[]>;
  /** Igual que llamar `getRelationships()` por cada id, pero en una sola consulta -- relaciones donde CUALQUIERA de los ids participa en cualquiera de los dos extremos (ver `DefaultReasoningCorrelateStage`). */
  getRelationshipsForInsights(
    context: LifeGraphContext,
    insightIds: readonly EntityId[],
  ): Promise<InsightRelationship[]>;
  saveRelationship(
    context: LifeGraphContext,
    relationship: InsightRelationship,
  ): Promise<InsightRelationship>;
}
