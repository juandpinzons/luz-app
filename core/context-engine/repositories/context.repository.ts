import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { Context } from "../entities/context";

/**
 * Solo persiste y recupera — misma disciplina que el resto de
 * repositorios del dominio. `getLatest` existe porque, a diferencia de
 * `Memory`/`Insight`, lo más común es querer el `Context` más reciente
 * de un LifeGraph, no uno específico por id.
 *
 * Si en la práctica Context resulta ser efímero (calculado en cada
 * request y nunca persistido), esta interfaz simplemente no se
 * implementa — no hay costo en dejarla definida ahora.
 */
export interface ContextRepository {
  getById(context: LifeGraphContext, id: EntityId): Promise<Context | null>;
  getLatest(context: LifeGraphContext): Promise<Context | null>;
  save(context: LifeGraphContext, ctx: Context): Promise<Context>;
}
