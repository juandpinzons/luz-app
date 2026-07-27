import type { EntityId } from "../../life/value-objects/entity-id";
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";
import type { Confidence } from "../../knowledge-engine/value-objects/confidence";

export const BELIEF_STATUSES = ["active", "expired", "retracted"] as const;
export type BeliefStatus = (typeof BELIEF_STATUSES)[number];

/**
 * Creencia consolidada sobre una persona ("Juan es muy curioso"),
 * síntesis de varios `Insight`s a través del tiempo -- no un Insight en
 * sí. Propio aggregate (igual que `Insight`/`Concept`): opera sobre un
 * LifeGraph, nunca miembro del aggregate `LifeGraph`. `confidence`
 * nunca es opcional: un Belief solo existe una vez consolidado, igual
 * que un Insight solo existe una vez validado.
 */
export interface Belief {
  id: EntityId;
  lifeGraphId: EntityId;
  subjectPersonId: EntityId;
  statement: string;
  domain?: LifeDomainType;
  status: BeliefStatus;
  confidence: Confidence;
  firstObservedAt: Date;
  lastReinforcedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
