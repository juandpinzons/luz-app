/**
 * De dónde vino la evidencia (REALITY_MODEL.md: conversaciones,
 * calendario, email, documentos y sensores son observaciones de la
 * realidad, no la realidad misma).
 */
export const MEMORY_SOURCES = [
  "conversation",
  "journal",
  "document",
  "calendar",
  "email",
  "sensor",
  "manual",
] as const;

export type MemorySource = (typeof MEMORY_SOURCES)[number];
