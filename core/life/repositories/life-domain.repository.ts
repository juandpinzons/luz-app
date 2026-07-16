import type { LifeDomain } from "../entities/life-domain";
import type { LifeRepository } from "./life-repository";

export type LifeDomainInput = Omit<
  LifeDomain,
  "id" | "lifeGraphId" | "createdAt" | "updatedAt"
>;

export type LifeDomainRepository = LifeRepository<LifeDomain, LifeDomainInput>;
