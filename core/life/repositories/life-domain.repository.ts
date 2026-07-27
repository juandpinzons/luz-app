import type { LifeDomain } from "../entities/life-domain";
import type { LifeGraphContext } from "../life-graph-context";
import type { LifeRepository } from "./life-repository";

export type LifeDomainInput = Omit<
  LifeDomain,
  "id" | "lifeGraphId" | "createdAt" | "updatedAt"
>;

export interface LifeDomainRepository
  extends LifeRepository<LifeDomain, LifeDomainInput> {
  /** Único por LifeGraph (`life_domains_life_graph_id_type_idx`) — usado por get-or-create. */
  getByType(
    context: LifeGraphContext,
    type: LifeDomain["type"],
  ): Promise<LifeDomain | null>;
}
