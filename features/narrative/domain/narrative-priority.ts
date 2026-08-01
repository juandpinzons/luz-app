/**
 * Misma escala que `LoopPriority` (`core/continuity-engine`),
 * `PresenceUrgencyLevel` (`features/presence/`) y `RecommendationPriority`
 * (`features/dashboard/`) -- Narrative no inventa una segunda noción de
 * prioridad, solo resume la que ya existe (mismo criterio documentado en
 * los tres). Definida de forma independiente, no importada -- mismo
 * patrón que los tres precedentes (ninguno de ellos importa de otro
 * tampoco).
 */
export const NARRATIVE_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export type NarrativePriority = (typeof NARRATIVE_PRIORITIES)[number];
