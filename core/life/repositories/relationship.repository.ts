import type { Relationship } from "../entities/relationship";
import type { LifeRepository } from "./life-repository";

export type RelationshipInput = Omit<
  Relationship,
  "id" | "lifeGraphId" | "createdAt" | "updatedAt"
>;

export type RelationshipRepository = LifeRepository<
  Relationship,
  RelationshipInput
>;
