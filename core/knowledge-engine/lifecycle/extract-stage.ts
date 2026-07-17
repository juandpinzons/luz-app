import type { RealitySnapshot } from "../../reality/reality-snapshot";
import type { PipelineContext } from "../pipeline-context";

/** Fragmento de información relevante extraído de la realidad disponible. */
export interface ExtractedItem {
  text: string;
}

/**
 * Recibe el `RealitySnapshot` (`core/reality`), no un `Memory` directo
 * (ADR-0013): Knowledge interpreta realidad, no solo memorias
 * aisladas — `context.memoryId` sigue identificando qué memoria
 * disparó esta corrida, pero el contenido a interpretar es el snapshot
 * completo (memoria relevante + estado de vida + señales externas).
 */
export interface ExtractStage {
  extract(
    snapshot: RealitySnapshot,
    context: PipelineContext,
  ): Promise<ExtractedItem[]>;
}
