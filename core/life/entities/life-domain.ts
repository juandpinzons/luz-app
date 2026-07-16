import type { EntityId } from "../value-objects/entity-id";
import type { LifeDomainType } from "../value-objects/life-domain-type";

/**
 * Instancia por LifeGraph de un área de vida (`LifeDomainType`). Existe
 * como entidad propia, y no solo como el value object, para poder
 * guardar el estado del grafo en esa área (prioridad, notas) sin
 * acoplarlo a ningún goal, project o habit en particular.
 */
export interface LifeDomain {
  id: EntityId;
  lifeGraphId: EntityId;
  type: LifeDomainType;
  /** Prioridad relativa frente a las demás áreas de vida, 0-100. */
  priority?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
