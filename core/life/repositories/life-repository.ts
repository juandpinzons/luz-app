import type { LifeGraphContext } from "../life-graph-context";
import type { EntityId } from "../value-objects/entity-id";

/**
 * Forma común de acceso a datos para las entidades del Life Graph.
 * Comparten el mismo patrón CRUD, escopado por `LifeGraphContext`
 * (ADR-0011) en vez del antiguo `UserContext` — todo query es "los
 * datos de este LifeGraph", no "los datos de este usuario". Consultas
 * específicas de dominio se agregan sobre esta base en fases
 * posteriores, no reemplazándola.
 */
export interface LifeRepository<
  TEntity,
  TCreateInput,
  TUpdateInput = Partial<TCreateInput>,
> {
  getById(context: LifeGraphContext, id: EntityId): Promise<TEntity | null>;
  list(context: LifeGraphContext): Promise<TEntity[]>;
  create(context: LifeGraphContext, input: TCreateInput): Promise<TEntity>;
  update(
    context: LifeGraphContext,
    id: EntityId,
    input: TUpdateInput,
  ): Promise<TEntity>;
  delete(context: LifeGraphContext, id: EntityId): Promise<void>;
}
