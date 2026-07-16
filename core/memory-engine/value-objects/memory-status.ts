/** Estado de ciclo de vida de una memoria. */
export const MEMORY_STATUSES = ["active", "archived", "forgotten"] as const;

export type MemoryStatus = (typeof MEMORY_STATUSES)[number];
