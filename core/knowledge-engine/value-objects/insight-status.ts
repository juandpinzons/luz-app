/** Coincide con `insightStatusEnum` (`core/db/schema/knowledge.ts`). */
export const INSIGHT_STATUSES = ["proposed", "validated", "rejected"] as const;

export type InsightStatus = (typeof INSIGHT_STATUSES)[number];
