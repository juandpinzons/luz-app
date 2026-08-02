import type { EntityId } from "../../life/value-objects/entity-id";

export const SEEN_PROMPT_STATUSES = ["seen", "accepted", "edited", "dismissed"] as const;
export type SeenPromptStatus = (typeof SEEN_PROMPT_STATUSES)[number];

/**
 * Estado único de "ya visto/resuelto" para una sugerencia puntual
 * (`docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md` §5.3) -- `subjectType`
 * identifica de qué tipo de sugerencia se trata ("intention_followup",
 * "goal_closure", y cualquier uso futuro de Dashboard/Learning),
 * `subjectId` el registro puntual (una Memory, un Goal...). Esta
 * primera integración (redesign del pipeline conversacional, Beta)
 * solo necesita "¿ya se vio esto?" -- `accepted`/`edited`/`dismissed`
 * quedan definidos para cuando Learning los necesite, sin construirse
 * todavía (nada en este redesign los escribe).
 */
export interface SeenPrompt {
  id: EntityId;
  lifeGraphId: EntityId;
  subjectType: string;
  subjectId: EntityId;
  status: SeenPromptStatus;
  firstSeenAt: Date;
  respondedAt?: Date;
}
