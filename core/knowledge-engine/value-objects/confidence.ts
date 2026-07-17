/**
 * El LLM propone; LUZ decide (ver `ValidateStage`) — `Confidence` solo
 * existe una vez que la etapa Validate la asigna, nunca antes. Un
 * `GeneratedInsight` cruda solo tiene `proposedConfidence: number`, no
 * este value object.
 */
export interface Confidence {
  /** 0-100. */
  score: number;
  assignedAt: Date;
}
