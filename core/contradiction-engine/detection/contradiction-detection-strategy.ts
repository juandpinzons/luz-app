import type { EntityId } from "../../life/value-objects/entity-id";

/** Entrada neutral -- ver docblock de `ContradictionRef` en la entidad. */
export interface ContradictionCandidate {
  refType: string;
  refId: EntityId;
  text: string;
}

export interface ProposedContradiction {
  /** Índice dentro de la lista `against` recibida por `detect()`. */
  candidateIndex: number;
  description: string;
  confidence: number;
}

/**
 * Compara UN candidato nuevo (ej. un Belief recién reforzado) contra
 * una lista acotada de candidatos ya existentes en una sola llamada de
 * IA -- nunca N llamadas por N pares, mismo criterio de costo que ya
 * aplica `AIInsightGenerationStrategy`/`AIConceptExtractionStrategy`
 * ("el LLM propone, LUZ decide", Principio 8).
 */
export interface ContradictionDetectionStrategy {
  detect(
    subject: ContradictionCandidate,
    against: ContradictionCandidate[],
  ): Promise<ProposedContradiction[]>;
}
