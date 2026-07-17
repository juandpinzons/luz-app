import type { RealityMemoryItem } from "../../reality/memory-context-snapshot";
import type { InsightType } from "../value-objects/insight-type";
import type { RelatedItem } from "../relationships/insight-relationship-strategy";
import type { PipelineContext } from "../pipeline-context";

/** Lo que el LLM propone. Todavía no es conocimiento persistido. */
export interface GeneratedInsight {
  type: InsightType;
  description: string;
  proposedConfidence: number;
  /**
   * `RealityMemoryItem[]` porque Memory es hoy la única fuente de
   * evidencia con un engine real — no una restricción permanente.
   * `core/reality/external-signal-snapshot.ts` (ADR-0013) ya reserva un
   * lugar neutral para Gmail/Calendar/Drive/Notion/Health/Slack y
   * similares cuando esos engines existan; ampliar este campo (unión de
   * tipos, o un tipo de evidencia neutral compartido) es el cambio que
   * corresponde entonces, deliberadamente no antes.
   */
  evidence: RealityMemoryItem[];
}

/**
 * Patrón estrategia: generar la descripción de un insight a partir de
 * memorias relacionadas es, por naturaleza, intercambiable (distintos
 * modelos, distintos prompts, distintas heurísticas) — ninguna
 * implementación concreta existe todavía.
 */
export interface InsightGenerationStrategy {
  generate(
    items: RelatedItem[],
    context: PipelineContext,
  ): Promise<GeneratedInsight[]>;
}
