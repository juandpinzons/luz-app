import { LIFE_DOMAIN_TYPES, type LifeDomainType } from "../../life/value-objects/life-domain-type";
import type { DomainCoverage } from "../entities/domain-coverage";

export interface DomainCoverageSignals {
  goalsCount: number;
  projectsCount: number;
  habitsCount: number;
  beliefsCount: number;
  conceptsCount: number;
}

const EMPTY_SIGNALS: DomainCoverageSignals = {
  goalsCount: 0,
  projectsCount: 0,
  habitsCount: 0,
  beliefsCount: 0,
  conceptsCount: 0,
};

/**
 * Pesos deliberadamente distintos por tipo de señal: un Belief o un
 * Concept son síntesis ya consolidadas (LUZ entendió algo, no solo
 * registró un dato), así que valen más que un Goal/Project/Habit
 * suelto -- mismo criterio que `SOURCE_BASE_WEIGHT` en
 * `DeterministicContextScoringStrategy` (un insight vale más que una
 * memoria puntual porque ya es interpretación). Pura, sin IO: quien
 * junta las señales reales (`assemble-reality-snapshot.ts`) vive en la
 * capa de aplicación.
 */
export function computeDomainCoverage(signals: DomainCoverageSignals): number {
  const raw =
    signals.goalsCount * 15 +
    signals.projectsCount * 10 +
    signals.habitsCount * 10 +
    signals.beliefsCount * 20 +
    signals.conceptsCount * 10;

  return Math.max(0, Math.min(100, raw));
}

/**
 * Una fila por cada `LifeDomainType`, orden ascendente por cobertura
 * (el menos entendido primero) -- convención documentada que todo
 * consumidor (`CuriosityStrategyRule`, Identity Model) puede asumir sin
 * volver a ordenar. Un dominio sin ninguna señal en `signalsByDomain`
 * cuenta como `EMPTY_SIGNALS` (coverage 0), nunca se omite de la
 * lista: la ausencia real se representa como ausencia.
 */
export function rankKnowledgeGaps(
  signalsByDomain: Partial<Record<LifeDomainType, DomainCoverageSignals>>,
): DomainCoverage[] {
  return LIFE_DOMAIN_TYPES.map((domain) => ({
    domain,
    coverageScore: computeDomainCoverage(signalsByDomain[domain] ?? EMPTY_SIGNALS),
  })).sort((a, b) => a.coverageScore - b.coverageScore);
}
