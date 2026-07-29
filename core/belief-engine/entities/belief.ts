import type { EntityId } from "../../life/value-objects/entity-id";
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";
import type { Confidence } from "../../knowledge-engine/value-objects/confidence";

export const BELIEF_STATUSES = ["active", "expired", "retracted"] as const;
export type BeliefStatus = (typeof BELIEF_STATUSES)[number];

/**
 * `life_domain` -- una creencia sobre un área de la vida de la persona
 * (el caso original, único hasta ahora). `communication_style` --
 * cómo prefiere que LUZ le hable (registro, extensión, nivel técnico),
 * nunca un área de vida -- `domain` (Wheel of Life) no tiene ningún
 * valor que le quede bien, así que necesita su propio eje de
 * clasificación en vez de sobrecargar "domain: undefined" como señal
 * (otras creencias sin domain claro por razones distintas también
 * quedarían undefined, ambiguo). Decidido por
 * `BeliefConsolidationStrategy` en el momento de la propuesta, la
 * misma fuente que ya decide `domain` -- nunca inferido después por
 * ausencia de otro campo.
 */
export const BELIEF_CATEGORIES = ["life_domain", "communication_style"] as const;
export type BeliefCategory = (typeof BELIEF_CATEGORIES)[number];

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
  category: BeliefCategory;
  status: BeliefStatus;
  confidence: Confidence;
  firstObservedAt: Date;
  lastReinforcedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
