import type { EntityId } from "../value-objects/entity-id";
import type { LifeDomainType } from "../value-objects/life-domain-type";

/**
 * Evento significativo en la línea de tiempo del LifeGraph. Las
 * referencias a otras entidades son opcionales porque un life event
 * puede no estar ligado a ninguna.
 */
export interface LifeEvent {
  id: EntityId;
  lifeGraphId: EntityId;
  title: string;
  description?: string;
  domain?: LifeDomainType;
  occurredAt: Date;
  relatedPersonIds?: EntityId[];
  relatedGoalId?: EntityId;
  relatedProjectId?: EntityId;
  createdAt: Date;
}
