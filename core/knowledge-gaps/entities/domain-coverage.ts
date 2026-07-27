import type { LifeDomainType } from "../../life/value-objects/life-domain-type";

/**
 * Cuánto entiende LUZ de un área de vida concreta -- 0 (nada
 * estructurado todavía) a 100 (goals/projects/habits/beliefs/concepts
 * reales cubren esta área). Nunca "la persona nunca habló de esto"
 * (esta puntuación no puede respaldar esa afirmación, mismo límite que
 * ya documentaba `CuriosityStrategyRule` antes de esta capacidad):
 * siempre "esto es lo que LUZ tiene estructurado hasta ahora".
 */
export interface DomainCoverage {
  domain: LifeDomainType;
  coverageScore: number;
}
