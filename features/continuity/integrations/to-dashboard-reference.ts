import type { ContinuityLoop } from "../../../core/continuity-engine";
import { createEntityId } from "../../../core/life/value-objects/entity-id";
import type { DashboardEntityReference } from "../../dashboard/services/build-follow-up-recommendations";

const DASHBOARD_LINKABLE_KINDS = new Set(["goal", "project", "habit", "person", "relationship"]);

/**
 * `ContinuityLoop.relatedEntities` -> `DashboardEntityReference[]` --
 * misión: "Expose clean contracts for... Dashboard." Filtra a los
 * `kind` que `DashboardEntityReference` sabe representar (mismo
 * criterio que `to-experience-card.ts`) -- un consumidor futuro de
 * Dashboard puede sumar estas referencias a su propia lista sin
 * traducir nada él mismo.
 */
export function toDashboardEntityReferences(loop: ContinuityLoop): DashboardEntityReference[] {
  return loop.relatedEntities
    .filter((entity) => DASHBOARD_LINKABLE_KINDS.has(entity.kind))
    .map((entity) => ({
      kind: entity.kind as "goal" | "project" | "habit" | "person" | "relationship",
      id: createEntityId(entity.id),
      title: entity.title,
    }));
}
