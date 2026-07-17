import type { RealityMemoryItem } from "../../reality/memory-context-snapshot";
import type { ClassifiedItem } from "../lifecycle/classify-stage";
import type { PipelineContext } from "../pipeline-context";

/**
 * `relatedMemories` son `RealityMemoryItem` (`core/reality`), no
 * `Memory` de `core/memory-engine` (ADR-0013) — Knowledge ya no
 * conoce ese tipo en absoluto.
 */
export interface RelatedItem extends ClassifiedItem {
  relatedMemories: RealityMemoryItem[];
}

/**
 * Patrón estrategia, igual que `MemoryRetrievalStrategy`
 * (`core/memory-engine`): encontrar memorias relacionadas puede
 * resolverse por coincidencia estructural, por similitud semántica, o
 * ambas — ninguna implementación concreta existe todavía.
 */
export interface InsightRelationshipStrategy {
  relate(
    items: ClassifiedItem[],
    context: PipelineContext,
  ): Promise<RelatedItem[]>;
}
