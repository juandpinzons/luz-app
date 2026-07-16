import type {
  GeneratedInsight,
  PipelineContext,
  ValidateStage,
  ValidatedInsight,
} from "../types";

/**
 * Etapa 5/6: Validate — etapa EXPLÍCITA (decisión CTO #5, no implícita
 * dentro de Generate). El LLM propone; esta etapa decide: asigna la
 * confianza final y el estado (validated/rejected). El LLM nunca
 * escribe directamente en memoria — solo esta etapa autoriza la
 * persistencia.
 *
 * Pendiente de implementación (decisión CTO #12): las reglas de
 * validación dependen de la lógica de negocio que aún no se ha
 * definido.
 */
export class NotImplementedValidateStage implements ValidateStage {
  async validate(
    _insights: GeneratedInsight[],
    _context: PipelineContext,
  ): Promise<ValidatedInsight[]> {
    throw new Error(
      "ValidateStage: validación de insights aún no implementada.",
    );
  }
}
