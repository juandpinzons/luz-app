import { LIFE_DOMAIN_LABEL } from "../../life/value-objects/life-domain-label";
import type { PredictivePatternCandidate } from "../entities/predictive-pattern-candidate";
import type { MovementDirection } from "../entities/domain-movement";

function verbFor(direction: MovementDirection): string {
  return direction === "strengthening" ? "mejora" : "se debilita";
}

/**
 * Plantilla determinista, sin IA -- a diferencia de un Insight
 * generado por interpretación (`AIInsightGenerationStrategy`), el
 * hallazgo aquí YA es el conteo exacto de `detectDomainCoMovement`, no
 * algo que necesite interpretación adicional. Pedirle a un LLM que lo
 * parafrasee añadiría riesgo de distorsión sin ningún beneficio real
 * (Principio 3: explicabilidad).
 */
export function describePattern(candidate: PredictivePatternCandidate): string {
  const fromLabel = LIFE_DOMAIN_LABEL[candidate.fromDomain];
  const toLabel = LIFE_DOMAIN_LABEL[candidate.toDomain];

  return `Se observa un patrón: cuando ${fromLabel} ${verbFor(candidate.fromDirection)}, ${toLabel} tiende a ${verbFor(candidate.toDirection)} poco después (visto ${candidate.occurrences} veces).`;
}

/** 50 base + 15 por ocurrencia adicional, tope 90 -- nunca certeza total sobre una muestra pequeña. */
export function computePatternConfidence(occurrences: number): number {
  return Math.min(90, 50 + occurrences * 15);
}
