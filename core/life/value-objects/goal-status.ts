export const GOAL_STATUSES = [
  "active",
  "paused",
  "completed",
  "abandoned",
] as const;

export type GoalStatus = (typeof GOAL_STATUSES)[number];
