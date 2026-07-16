/**
 * Resultado de rankear una memoria — no el algoritmo (ver
 * `ranking/memory-ranking-strategy.ts`), solo su salida: un score y
 * cuándo se calculó. Value object porque no tiene identidad propia,
 * solo existe en función de sus valores.
 */
export interface MemoryRank {
  /** Importancia/relevancia relativa, 0-100. */
  score: number;
  rankedAt: Date;
}
