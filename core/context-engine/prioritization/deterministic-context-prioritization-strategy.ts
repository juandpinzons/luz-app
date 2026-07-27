import type { LifeGraphContext } from "../../life/life-graph-context";
import type { ContextItem } from "../entities/context";
import type { ContextPrioritizationStrategy } from "./context-prioritization-strategy";

/**
 * Antes de este engine, el techo real de "contexto relevante" ya
 * asumido por el chat era `RELEVANT_MEMORY_LIMIT` (5) +
 * `RELEVANT_INSIGHT_LIMIT` (3) = 8 (`assembleRealitySnapshot`) — ese
 * mismo techo se preserva aquí, ahora aplicado a través de las cuatro
 * fuentes en vez de por fuente aislada. No es un límite nuevo, es el
 * mismo ya validado en producción, generalizado.
 */
const MAX_CONTEXT_ITEMS = 8;

/**
 * Única implementación real de `ContextPrioritizationStrategy` —
 * ordena por `relevanceScore` descendente y recorta al techo. Cada
 * candidato que llega aquí ya pasó su propio filtro de calidad aguas
 * arriba (memoria con señal real, insight validado, goal/proyecto/
 * hábito activo) — recortar no distingue "real" de "relleno" (esa
 * distinción ya se resolvió antes de `ContextEngine`), solo decide
 * cuánto de lo real cabe en una respuesta, mismo criterio de brevedad
 * que ya rige el resto de la respuesta (`VoiceSignature.maxLines`,
 * `core/voice-engine`).
 */
export class DeterministicContextPrioritizationStrategy
  implements ContextPrioritizationStrategy
{
  async prioritize(
    items: ContextItem[],
    _context: LifeGraphContext,
  ): Promise<ContextItem[]> {
    return [...items]
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, MAX_CONTEXT_ITEMS);
  }
}
