import type { Confidence } from "../value-objects/confidence";
import type { InsightStatus } from "../value-objects/insight-status";
import type { GeneratedInsight } from "../generation/insight-generation-strategy";
import type { PipelineContext } from "../pipeline-context";

/**
 * Lo que el Knowledge Engine decide después de validar. El LLM
 * propone; LUZ decide — `confidence` y `status` los asigna esta etapa,
 * nunca el LLM directamente.
 *
 * `evidence` (heredado de `GeneratedInsight`) es hoy `RealityMemoryItem[]`
 * porque Memory es la única fuente de evidencia con un engine real. Esta
 * interfaz y toda implementación de `InsightValidationStrategy` deben
 * tratarlo como opaco — nunca asumir ni depender de esa forma concreta.
 * Ver `GeneratedInsight.evidence` para dónde vive la decisión de qué
 * tipos de evidencia son válidos.
 */
export interface ValidatedInsight extends GeneratedInsight {
  confidence: Confidence;
  status: InsightStatus;
}

/**
 * Patrón estrategia: validar puede significar un umbral de confianza
 * fijo, reglas explícitas, o intervención humana — ninguna
 * implementación concreta existe todavía.
 */
export interface InsightValidationStrategy {
  validate(
    insights: GeneratedInsight[],
    context: PipelineContext,
  ): Promise<ValidatedInsight[]>;
}
