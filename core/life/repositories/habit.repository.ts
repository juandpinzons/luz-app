import type { Habit } from "../entities/habit";
import type { LifeRepository } from "./life-repository";

export type HabitInput = Omit<
  Habit,
  "id" | "lifeGraphId" | "createdAt" | "updatedAt"
>;

export type HabitRepository = LifeRepository<Habit, HabitInput>;
