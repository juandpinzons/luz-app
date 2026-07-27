import type { LifeDomain } from "../entities/life-domain";
import type { LifeDomainType } from "../value-objects/life-domain-type";
import type { LifeGraphContext } from "../life-graph-context";
import type { LifeDomainRepository } from "../repositories/life-domain.repository";

/**
 * La única forma en que una fila de `life_domains` debería aparecer:
 * nunca un backfill masivo de los ocho dominios para todo LifeGraph
 * existente, siempre bajo demanda (primera vez que algo necesita leer
 * o escribir prioridad/notas de esa área). `getByType` + `create`
 * (upsert real, ver `DrizzleLifeDomainRepository`) hacen esto seguro
 * ante llamadas concurrentes.
 */
export async function getOrCreateLifeDomain(
  repository: LifeDomainRepository,
  context: LifeGraphContext,
  type: LifeDomainType,
): Promise<LifeDomain> {
  const existing = await repository.getByType(context, type);
  if (existing) {
    return existing;
  }

  return repository.create(context, { type });
}
