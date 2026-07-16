import type {
  ClassifiedItem,
  ClassifyStage,
  ExtractedItem,
  PipelineContext,
} from "../types";

/**
 * Etapa 2/6: Classify — determina el tipo de conocimiento (patrón,
 * preferencia, hecho, riesgo, recomendación) y su importancia relativa.
 *
 * Pendiente de implementación (decisión CTO #12).
 */
export class NotImplementedClassifyStage implements ClassifyStage {
  async classify(
    _items: ExtractedItem[],
    _context: PipelineContext,
  ): Promise<ClassifiedItem[]> {
    throw new Error(
      "ClassifyStage: clasificación de información aún no implementada.",
    );
  }
}
