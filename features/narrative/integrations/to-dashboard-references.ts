import { createEntityId } from "../../../core/life";
import type { DashboardEntityReference } from "../../dashboard/services/build-follow-up-recommendations";
import type { NarrativeRelatedEntity } from "../domain/narrative-related-entity";
import type { NarrativeThread } from "../domain/narrative-thread";

/** Kinds de `NarrativeRelatedEntity` que también son `id: EntityId` reales del Life Graph -- mismo criterio que `DASHBOARD_LINKABLE_KINDS` (`features/continuity/integrations/to-experience-card.ts`). */
const LINKABLE_KINDS = new Set<string>(["goal", "project", "habit", "person", "relationship"]);

function toDashboardEntityReference(entity: NarrativeRelatedEntity): DashboardEntityReference | null {
  if (!LINKABLE_KINDS.has(entity.kind)) return null;
  return {
    kind: entity.kind as "goal" | "project" | "habit" | "person" | "relationship",
    id: createEntityId(entity.id),
    title: entity.title,
  };
}

/**
 * `NarrativeThread.relatedEntities` -> `DashboardEntityReference[]` --
 * misión: "expose clean contracts for... Dashboard." Solo los kinds que
 * Dashboard ya sabe enlazar (mismo criterio que `toExperienceCard`,
 * `features/continuity/integrations/`) -- `calendar_event`/
 * `email_message`/`memory`/`curiosity_question`/`conversation`/`belief`/
 * `domain` quedan fuera, honesto: todavía no hay ruta real para esos.
 * Ningún llamador real hoy.
 */
export function toDashboardEntityReferences(thread: NarrativeThread): DashboardEntityReference[] {
  return thread.relatedEntities
    .map(toDashboardEntityReference)
    .filter((entity): entity is DashboardEntityReference => entity !== null);
}
