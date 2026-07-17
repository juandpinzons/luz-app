/**
 * Coincide a propósito con `insightTypeEnum`
 * (`core/db/schema/knowledge.ts`) — mismo vocabulario, ahora
 * desacoplado de Drizzle.
 */
export const INSIGHT_TYPES = [
  "pattern",
  "preference",
  "fact",
  "risk",
  "recommendation",
] as const;

export type InsightType = (typeof INSIGHT_TYPES)[number];
