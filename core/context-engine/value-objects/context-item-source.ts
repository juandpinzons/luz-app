/** Coincide con las tres secciones de `RealitySnapshot` (`core/reality`, ADR-0013). */
export const CONTEXT_ITEM_SOURCES = ["life", "memory", "signal"] as const;

export type ContextItemSource = (typeof CONTEXT_ITEM_SOURCES)[number];
