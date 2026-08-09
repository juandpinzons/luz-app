import { MIN_SCORE_WITH_UNDERSTANDING_SIGNAL } from "../../../core/memory-engine/ranking/deterministic-memory-ranking-strategy";
import type { MemoryWithConnections } from "./search-memories";

/**
 * Techo defensivo -- hoy `rank.score >= MIN_SCORE_WITH_UNDERSTANDING_SIGNAL`
 * rara vez devuelve muchas memorias (ver docs/engineering/investigations/2026-08-02_*,
 * 10.3% de recall sobre esa misma señal), pero si una cuenta con mucho
 * uso real algún día tiene más, esta pantalla sigue siendo "un puñado",
 * no una segunda lista completa.
 */
const MAX_HIGHLIGHTS = 12;

/**
 * "Momentos que más han quedado" (UX_ARCHITECTURE_REFINEMENT_V1.md §3) --
 * reusa el mismo umbral que ya decide qué memoria profundiza la
 * comprensión narrativa de la persona (`MIN_SCORE_WITH_UNDERSTANDING_SIGNAL`,
 * ya real en Knowledge Engine eligibility y en el chat en vivo) en vez
 * de inventar un segundo corte solo para esta pantalla. Nunca rellena
 * hasta un mínimo -- una cuenta con pocas (o cero) memorias que lo
 * alcancen se queda con pocas (o cero) highlights; la pantalla que
 * llama a esto es responsable de decir eso honestamente, no de
 * disfrazarlo.
 */
export function selectMemoryHighlights(
  memories: readonly MemoryWithConnections[],
): MemoryWithConnections[] {
  return memories
    .filter((memory) => (memory.rank?.score ?? 0) >= MIN_SCORE_WITH_UNDERSTANDING_SIGNAL)
    .sort((a, b) => (b.rank?.score ?? 0) - (a.rank?.score ?? 0))
    .slice(0, MAX_HIGHLIGHTS);
}
