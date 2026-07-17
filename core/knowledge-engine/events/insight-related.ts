import type { DomainEvent } from "../../life/events/domain-event";
import type { EntityId } from "../../life/value-objects/entity-id";

export interface InsightRelatedPayload {
  fromInsightId: EntityId;
  toInsightId: EntityId;
  relationType: string;
}

export type InsightRelated = DomainEvent<
  "knowledge.insight_related",
  InsightRelatedPayload
>;
