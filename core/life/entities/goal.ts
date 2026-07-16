import type { EntityId } from "../value-objects/entity-id";
import type { GoalStatus } from "../value-objects/goal-status";
import type { LifeDomainType } from "../value-objects/life-domain-type";

export interface Goal {
  id: EntityId;
  lifeGraphId: EntityId;
  title: string;
  description?: string;
  status: GoalStatus;
  domain?: LifeDomainType;
  targetDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
