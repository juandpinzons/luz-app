import type { EntityId } from "../value-objects/entity-id";
import type { GoalStatus } from "../value-objects/goal-status";
import type { DomainEvent } from "./domain-event";

export interface GoalCreatedPayload {
  goalId: EntityId;
  title: string;
  status: GoalStatus;
}

export type GoalCreated = DomainEvent<"life.goal_created", GoalCreatedPayload>;
