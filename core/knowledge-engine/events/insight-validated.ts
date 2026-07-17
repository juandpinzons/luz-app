import type { EntityId } from "../../life/value-objects/entity-id";
import type { DomainEvent } from "../../life/events/domain-event";
import type { InsightStatus } from "../value-objects/insight-status";
import type { InsightType } from "../value-objects/insight-type";

/** Cubre ambos desenlaces de Validate — `status` distingue validado de rechazado. */
export interface InsightValidatedPayload {
  insightId: EntityId;
  type: InsightType;
  status: InsightStatus;
  confidence: number;
}

export type InsightValidated = DomainEvent<
  "knowledge.insight_validated",
  InsightValidatedPayload
>;
