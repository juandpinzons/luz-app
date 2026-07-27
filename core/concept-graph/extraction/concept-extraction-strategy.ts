import type { Insight } from "../../knowledge-engine/entities/insight";

export interface ProposedConcept {
  label: string;
  description?: string;
}

export interface ProposedConceptRelation {
  fromLabel: string;
  toLabel: string;
  relationType: string;
}

export interface ConceptExtractionResult {
  concepts: ProposedConcept[];
  relations: ProposedConceptRelation[];
  /** 0-100, propuesta por la estrategia — LUZ decide si pasa el umbral (`extract-concepts-from-insight.ts`). */
  confidence: number;
}

/**
 * Propone conceptos/relaciones a partir de un `Insight` ya validado
 * (nunca de una memoria cruda: un concepto abstrae sobre algo que el
 * Knowledge Engine ya interpretó, no sobre el hecho crudo). "El LLM
 * propone, LUZ decide" (Principio 8) — igual que
 * `InsightGenerationStrategy`, quien implemente esto SOLO propone.
 */
export interface ConceptExtractionStrategy {
  extract(
    insight: Insight,
    evidenceText: string[],
  ): Promise<ConceptExtractionResult | null>;
}
