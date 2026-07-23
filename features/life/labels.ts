import type {
  GoalStatus,
  ProjectStatus,
  RelationshipType,
} from "../../core/life";

/** Etiquetas en español para los value objects de Life — solo presentación, nunca una segunda fuente de verdad sobre el estado. */

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  active: "activo",
  paused: "pausado",
  completed: "completado",
  abandoned: "abandonado",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "planeando",
  active: "activo",
  on_hold: "en pausa",
  completed: "completado",
  cancelled: "cancelado",
};

export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, string> = {
  family: "familia",
  partner: "pareja",
  friend: "amistad",
  colleague: "colega",
  mentor: "mentor",
  mentee: "aprendiz",
  acquaintance: "conocido",
  other: "otro",
};
