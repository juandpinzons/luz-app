import type { Goal } from "../entities/goal";
import type { LifeRepository } from "./life-repository";

export type GoalInput = Omit<
  Goal,
  "id" | "lifeGraphId" | "createdAt" | "updatedAt"
>;

export type GoalRepository = LifeRepository<Goal, GoalInput>;
