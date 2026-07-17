import type { DomainEvent } from "../../life/events/domain-event";
import type { InsightType } from "../value-objects/insight-type";

/**
 * Emitido al final de Generate, antes de Validate/Persist — todavía no
 * hay un `Insight` persistido, por eso no lleva `insightId`.
 */
export interface InsightGeneratedPayload {
  type: InsightType;
  proposedConfidence: number;
}

export type InsightGenerated = DomainEvent<
  "knowledge.insight_generated",
  InsightGeneratedPayload
>;
