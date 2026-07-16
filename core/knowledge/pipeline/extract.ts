import type { ExtractedItem, ExtractStage, PipelineContext } from "../types";

/**
 * Etapa 1/6: Extract — identifica fragmentos de información relevante
 * en la fuente cruda (mensaje de conversación, entrada de diario,
 * documento).
 *
 * Pendiente de implementación (decisión CTO #12): requiere una llamada
 * al proveedor de IA para extraer información, fuera de alcance de este
 * entregable. Falla explícitamente en vez de devolver una lista vacía
 * para no simular un pipeline que en realidad no corre.
 */
export class NotImplementedExtractStage implements ExtractStage {
  async extract(_context: PipelineContext): Promise<ExtractedItem[]> {
    throw new Error(
      "ExtractStage: extracción de información aún no implementada.",
    );
  }
}
