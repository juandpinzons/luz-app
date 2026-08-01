/**
 * Misma escala que `RecommendationPriority`
 * (`features/dashboard/services/build-follow-up-recommendations.ts`) y
 * `PresenceUrgencyLevel` (`features/presence/domain/presence-state.ts`)
 * -- Continuity no inventa una segunda noción de prioridad, reutiliza
 * el vocabulario de producto ya establecido (misión: "consume existing
 * public contracts whenever possible"). Definido de forma independiente
 * (no importado desde `features/`) porque `core/` nunca depende de
 * `features/` -- mismo principio de dirección de dependencias que ya
 * rige el resto de `core/` (Reality Snapshot, Context Engine, etc.).
 */
export const LOOP_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export type LoopPriority = (typeof LOOP_PRIORITIES)[number];
