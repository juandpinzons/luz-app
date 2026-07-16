import type { Project } from "../entities/project";
import type { LifeRepository } from "./life-repository";

export type ProjectInput = Omit<
  Project,
  "id" | "lifeGraphId" | "createdAt" | "updatedAt"
>;

export type ProjectRepository = LifeRepository<Project, ProjectInput>;
