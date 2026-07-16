import type { Person } from "../entities/person";
import type { LifeRepository } from "./life-repository";

export type PersonInput = Omit<
  Person,
  "id" | "lifeGraphId" | "createdAt" | "updatedAt"
>;

export type PersonRepository = LifeRepository<Person, PersonInput>;
