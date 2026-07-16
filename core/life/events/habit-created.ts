import type { EntityId } from "../value-objects/entity-id";
import type { DomainEvent } from "./domain-event";

export interface HabitCreatedPayload {
  habitId: EntityId;
  title: string;
  goalId?: EntityId;
}

export type HabitCreated = DomainEvent<
  "life.habit_created",
  HabitCreatedPayload
>;
