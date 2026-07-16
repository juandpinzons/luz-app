import type { EntityId } from "../value-objects/entity-id";
import type { LifeDomainType } from "../value-objects/life-domain-type";
import type { ProjectStatus } from "../value-objects/project-status";

export interface Project {
  id: EntityId;
  lifeGraphId: EntityId;
  /** Goal al que este project contribuye, si aplica. */
  goalId?: EntityId;
  title: string;
  description?: string;
  status: ProjectStatus;
  domain?: LifeDomainType;
  startDate?: Date;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
