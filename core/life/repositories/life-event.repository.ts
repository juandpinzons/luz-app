import type { LifeEvent } from "../entities/life-event";
import type { LifeRepository } from "./life-repository";

export type LifeEventInput = Omit<
  LifeEvent,
  "id" | "lifeGraphId" | "createdAt"
>;

export type LifeEventRepository = LifeRepository<LifeEvent, LifeEventInput>;
