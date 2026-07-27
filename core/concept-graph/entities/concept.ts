import type { EntityId } from "../../life/value-objects/entity-id";
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";

/**
 * Abstracción semántica ("Disciplina", "Confianza"), distinta de un
 * `Insight` (una interpretación puntual de evidencia concreta) — varios
 * insights pueden ser evidencia del mismo concepto. Propio aggregate,
 * igual que `Insight`/`Memory`: opera SOBRE un LifeGraph, nunca es
 * miembro del aggregate `LifeGraph` (ADR-0011).
 */
export interface Concept {
  id: EntityId;
  lifeGraphId: EntityId;
  label: string;
  description?: string;
  domain?: LifeDomainType;
  createdAt: Date;
  updatedAt: Date;
}
