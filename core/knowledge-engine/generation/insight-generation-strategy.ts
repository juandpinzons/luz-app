import type { RealityMemoryItem } from "../../reality/memory-context-snapshot";
import type { InsightType } from "../value-objects/insight-type";
import type { RelatedItem } from "../relationships/insight-relationship-strategy";
import type { PipelineContext } from "../pipeline-context";

/** Lo que el LLM propone. Todavía no es conocimiento persistido. */
export interface GeneratedInsight {
  type: InsightType;
  description: string;
  proposedConfidence: number;
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
