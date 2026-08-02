import type { ContinuityLoop, LoopPriority } from "../../../core/continuity-engine";
import { createEntityId } from "../../../core/life/value-objects/entity-id";
import type { DashboardAction, DashboardEntityReference } from "../../dashboard/services/build-follow-up-recommendations";
import type { ExperienceCard, ExperienceCardCategory } from "../../experience/domain/experience-state";

const IMPORTANCE_BY_PRIORITY: Readonly<Record<LoopPriority, number>> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/** Kinds de `LoopRelatedEntity` que también son `id: EntityId` reales del Life Graph -- los únicos para los que `DashboardAction.targetEntity` puede construirse sin inventar un id. */
const DASHBOARD_LINKABLE_KINDS = new Set(["goal", "project", "habit", "person", "relationship"]);

function deriveCategory(loop: ContinuityLoop): ExperienceCardCategory {
  if (loop.trigger.reason === "deadline") return "upcoming_deadline";
  if (loop.trigger.reason === "important_meeting" || loop.trigger.reason === "future_commitment") return "calendar_moment";
  // Nunca "focus"/"celebration" -- esos son el resultado de la arbitración PROPIA de Experience (Fases 1-5), no algo que Continuity deba reclamar para sí.
  return "attention";
}

function deriveAction(loop: ContinuityLoop): DashboardAction | undefined {
  const primary = loop.relatedEntities[0];
  if (!primary || !DASHBOARD_LINKABLE_KINDS.has(primary.kind)) return undefined;

  const targetEntity: DashboardEntityReference = {
    kind: primary.kind as "goal" | "project" | "habit" | "person" | "relationship",
    id: createEntityId(primary.id),
    title: primary.title,
  };

  return { kind: "open_entity", targetEntity };
}

/**
 * `ContinuityLoop` -> candidata de `ExperienceCard` -- misión: "Expose
 * clean contracts for: Experience Intelligence... Do NOT deeply
 * integrate yet." Esta función NUNCA se llama desde
 * `features/experience/` hoy (cero import cruzado en ese sentido) --
 * es el contrato que un futuro cambio en
 * `features/experience/services/collect-candidates.ts` podría sumar
 * como una fuente más, junto a Presence/Calendar/Dashboard, sin que
 * `features/experience/` tenga que conocer nada de Continuity más allá
 * de este tipo de salida ya público (`ExperienceCard`).
 *
 * `action` queda `undefined` cuando `relatedEntities[0]` no es un kind
 * que `DashboardEntityReference` sepa enlazar (`calendar_event`/
 * `email_message`/`curiosity_question`/`memory`/`conversation`/
 * `belief`) -- honesto: todavía no hay una ruta real para esos, nunca
 * un enlace inventado.
 */
export function toExperienceCard(loop: ContinuityLoop): ExperienceCard {
  return {
    key: `continuity:${loop.id}`,
    category: deriveCategory(loop),
    title: loop.title,
    detail: loop.trigger.summary,
    importance: IMPORTANCE_BY_PRIORITY[loop.priority],
    action: deriveAction(loop),
  };
}
