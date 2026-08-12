import type {
  GoalStatus,
  LifeDomainType,
  ProjectStatus,
  RelationshipType,
} from "../../core/life";
import type { MemoryType } from "../../core/memory-engine";
import type { InsightType } from "../../core/knowledge-engine";
import type { BeliefTrend } from "../../core/belief-engine";

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

/** Vocabulario de `Memory.type` (`core/memory-engine`) -- la categoría real que Memory ya asigna a cada recuerdo, nunca una clasificación nueva inventada para mostrar. */
export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  fact: "Hechos",
  pattern: "Patrones",
  ritual: "Rituales",
  preference: "Preferencias",
  relationship: "Relaciones",
  goal: "Objetivos",
  event: "Eventos",
  intention: "Intenciones",
};

/** Vocabulario de `Insight.type` (`core/knowledge-engine`) -- mismo criterio que `MEMORY_TYPE_LABELS`. */
export const INSIGHT_TYPE_LABELS: Record<InsightType, string> = {
  pattern: "Patrones",
  preference: "Preferencias",
  fact: "Hechos",
  risk: "Riesgos",
  recommendation: "Recomendaciones",
};

/**
 * Distinto a propósito de `LIFE_DOMAIN_LABEL` (`core/life`) -- ese es
 * para texto generado hacia LUZ/el prompt ("su salud", tercera
 * persona posesiva), su propio docblock dice explícitamente "nunca
 * para mostrar en UI". Estas son las etiquetas de UI real -- nombres
 * de dominio limpios para un chip de filtro, no una frase.
 */
export const LIFE_DOMAIN_UI_LABELS: Record<LifeDomainType, string> = {
  health: "Salud",
  career: "Carrera",
  finances: "Finanzas",
  relationships: "Relaciones",
  personal_growth: "Crecimiento personal",
  leisure: "Ocio",
  home: "Hogar",
  spirituality: "Espiritualidad",
};

/**
 * War Room 2026-08-09 -- antes vivía duplicado como un `Record` local
 * dentro de `app/life/[kind]/[id]/page.tsx` (su único consumidor hasta
 * hoy); movido acá para que `/life/identity` (segundo consumidor real,
 * el resumen donde el Founder de verdad la encuentra primero) use
 * exactamente las mismas palabras, nunca una segunda redacción.
 */
export const BELIEF_TREND_LABELS: Record<BeliefTrend, string> = {
  new: "recién identificada",
  strengthening: "fortaleciéndose",
  weakening: "debilitándose",
  stable: "estable",
};
