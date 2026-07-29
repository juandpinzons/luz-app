import type { LifeDomainType } from "../../life/value-objects/life-domain-type";
import type { BeliefCategory } from "../entities/belief";
import type { Insight } from "../../knowledge-engine/entities/insight";

export interface ProposedBeliefStatement {
  /** Frase sobre la persona, ej. "Juan es una persona disciplinada con su salud". */
  statement: string;
  domain?: LifeDomainType;
  /**
   * `undefined` -> `"life_domain"` (`consolidate-belief-from-insight.ts`
   * decide el default, nunca esta interfaz) -- la mayoría de las
   * propuestas siguen siendo sobre un área de vida, así que no vale la
   * pena exigir que cada estrategia lo declare explícitamente para el
   * caso común.
   */
  category?: BeliefCategory;
  /** 0-100, propuesta por la estrategia -- LUZ decide el umbral (`consolidate-belief-from-insight.ts`). */
  confidence: number;
}

/**
 * Propone, a partir de un Insight ya validado, si hay una creencia
 * duradera sobre la persona detrás de esa evidencia -- "el LLM
 * propone, LUZ decide" (Principio 8), igual que
 * `InsightGenerationStrategy`/`ConceptExtractionStrategy`.
 */
export interface BeliefConsolidationStrategy {
  proposeStatement(
    insight: Insight,
    evidenceText: string[],
  ): Promise<ProposedBeliefStatement | null>;
}
