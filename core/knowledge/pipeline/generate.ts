import type {
  GenerateStage,
  GeneratedInsight,
  PipelineContext,
  RelatedItem,
} from "../types";

/**
 * Etapa 4/6: Generate — el LLM propone insights a partir de la
 * información relacionada. Esto es una propuesta, no conocimiento
 * persistido: la etapa Validate decide si se guarda y con qué
 * confianza.
 *
 * Pendiente de implementación (decisión CTO #12).
 */
export class NotImplementedGenerateStage implements GenerateStage {
  async generate(
    _items: RelatedItem[],
    _context: PipelineContext,
  ): Promise<GeneratedInsight[]> {
    throw new Error(
      "GenerateStage: generación de insights aún no implementada.",
    );
  }
}
