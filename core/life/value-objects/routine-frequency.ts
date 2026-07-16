export const ROUTINE_FREQUENCIES = [
  "daily",
  "weekly",
  "monthly",
  "custom",
] as const;

export type RoutineFrequency = (typeof ROUTINE_FREQUENCIES)[number];
