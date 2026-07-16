import type { EntityId } from "../value-objects/entity-id";
import type { LifeDomainType } from "../value-objects/life-domain-type";

/**
 * Comportamiento recurrente que el usuario declara explícitamente. Se
 * distingue de `Routine`, que es un patrón detectado por el sistema a
 * partir de comportamiento observado, no declarado.
 */
export interface Habit {
  id: EntityId;
  lifeGraphId: EntityId;
  goalId?: EntityId;
  title: string;
  description?: string;
  domain?: LifeDomainType;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
