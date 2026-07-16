import type {
  ClassifiedItem,
  PipelineContext,
  RelatedItem,
  RelateStage,
} from "../types";

/**
 * Etapa 3/6: Relate — conecta la información clasificada con entidades
 * ya existentes en el Knowledge Graph Personal (personas, proyectos,
 * hábitos, objetivos, insights previos).
 *
 * Pendiente de implementación (decisión CTO #12).
 */
export class NotImplementedRelateStage implements RelateStage {
  async relate(
    _items: ClassifiedItem[],
    _context: PipelineContext,
  ): Promise<RelatedItem[]> {
    throw new Error(
      "RelateStage: relación con entidades existentes aún no implementada.",
    );
  }
}
