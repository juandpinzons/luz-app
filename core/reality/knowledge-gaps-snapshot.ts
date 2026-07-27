import type { LifeDomainType } from "../life/value-objects/life-domain-type";

/**
 * Proyección mínima de `DomainCoverage` (`core/knowledge-gaps`) --
 * mismo criterio que `RealityInsightItem`: `core/reality` no importa el
 * tipo real, un futuro ensamblador lo traduce a esta forma.
 */
export interface RealityDomainCoverage {
  domain: LifeDomainType;
  coverageScore: number;
}

/**
 * Qué tan bien entiende LUZ cada área de vida ahora mismo -- orden
 * ascendente por cobertura, el menos entendido primero (convención de
 * `rankKnowledgeGaps`, documentada ahí, no vuelta a imponer aquí).
 */
export interface KnowledgeGapsSnapshot {
  domains: RealityDomainCoverage[];
}
