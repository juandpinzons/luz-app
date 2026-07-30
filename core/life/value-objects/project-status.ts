export const PROJECT_STATUSES = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Único punto de verdad de "qué cuenta como inactivo" -- usado tanto por `listActiveProjects` como por `DrizzleProjectRepository.listActive` (SQL), para que nunca queden desincronizados. */
export const INACTIVE_PROJECT_STATUSES: readonly ProjectStatus[] = ["completed", "cancelled"];
