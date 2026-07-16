/**
 * Tipos de memoria (MEMORY_MODEL.md). Memory almacena evidencia cruda;
 * Knowledge, un engine independiente, es quien la conecta en
 * significado — este vocabulario no debe confundirse con
 * `InsightType` (`core/db/schema/knowledge.ts`), que clasifica lo que
 * Knowledge produce, no lo que Memory captura.
 */
export const MEMORY_TYPES = [
  "fact",
  "pattern",
  "ritual",
  "preference",
  "relationship",
  "goal",
  "event",
  "intention",
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];
