import type { LifeGraphContext } from "../../life/life-graph-context";
import type { Memory } from "../entities/memory";
import type { MemoryRank } from "../value-objects/memory-rank";

/**
 * Patrón estrategia a propósito: "importancia" puede calcularse por
 * recencia, por frecuencia de acceso, por señales explícitas del
 * usuario, etc. — ninguna implementación concreta existe todavía, y
 * ADR-0004 (Hybrid Memory) ya anticipa más de un enfoque conviviendo.
 */
export interface MemoryRankingStrategy {
  rank(context: LifeGraphContext, memory: Memory): Promise<MemoryRank>;
}
