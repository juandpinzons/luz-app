export const GOAL_STATUSES = [
  "active",
  "paused",
  "completed",
  "abandoned",
] as const;

export type GoalStatus = (typeof GOAL_STATUSES)[number];

/** Único punto de verdad de "qué cuenta como inactivo" -- usado tanto por `listActiveGoals` como por `DrizzleGoalRepository.listActive` (SQL), para que nunca queden desincronizados. */
export const INACTIVE_GOAL_STATUSES: readonly GoalStatus[] = ["completed", "abandoned"];
