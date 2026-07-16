import type { Routine } from "../entities/routine";
import type { LifeRepository } from "./life-repository";

export type RoutineInput = Omit<
  Routine,
  "id" | "lifeGraphId" | "createdAt" | "updatedAt"
>;

export type RoutineRepository = LifeRepository<Routine, RoutineInput>;
