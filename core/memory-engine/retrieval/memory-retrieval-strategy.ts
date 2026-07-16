import type { LifeGraphContext } from "../../life/life-graph-context";
import type { Memory } from "../entities/memory";
import type { MemoryQuery } from "./memory-query";

/**
 * Patrón estrategia (ADR-0004 Hybrid Memory): recuperación estructurada
 * (filtros exactos sobre `MemoryQuery`) y recuperación semántica
 * (embeddings) son implementaciones distintas de este mismo contrato,
 * ninguna existe todavía — igual que `SemanticMemoryRepository` en el
 * `core/memory` actual sigue pendiente de embeddings.
 */
export interface MemoryRetrievalStrategy {
  retrieve(context: LifeGraphContext, query: MemoryQuery): Promise<Memory[]>;
}
