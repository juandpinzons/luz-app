import type { RealitySnapshot } from "../../reality/reality-snapshot";
import type { ClassifyStage } from "../lifecycle/classify-stage";
import type { ExtractStage } from "../lifecycle/extract-stage";
import type { PersistStage } from "../lifecycle/persist-stage";
import type { InsightGenerationStrategy } from "../generation/insight-generation-strategy";
import type { InsightRelationshipStrategy } from "../relationships/insight-relationship-strategy";
import type { InsightValidationStrategy } from "../validation/insight-validation-strategy";
import type { PipelineContext } from "../pipeline-context";

/**
 * Las dependencias que una implementación de `KnowledgeEngine` compone,
 * siempre en el mismo orden: Extract → Classify → Relate → Generate →
 * Validate → Persist (decisión CTO #5, preservada de
 * `core/knowledge/knowledge-engine.ts`). Solo el tipo — orquestarlas es
 * lógica de negocio, fuera de alcance de esta foundation.
 */
export interface KnowledgeEngineStages {
  extract: ExtractStage;
  classify: ClassifyStage;
  relate: InsightRelationshipStrategy;
  generate: InsightGenerationStrategy;
  validate: InsightValidationStrategy;
  persist: PersistStage;
}

/**
 * Único punto de acceso al Knowledge Engine que vería el resto del
 * dominio. Contrato únicamente: sin implementación. Recibe el
 * `RealitySnapshot` ya ensamblado (ADR-0013) — de dónde viene ese
 * snapshot (worker, evento, llamada directa) no le concierne a esta
 * interfaz, y Knowledge nunca ensambla uno por sí mismo.
 */
export interface KnowledgeEngine {
  run(snapshot: RealitySnapshot, context: PipelineContext): Promise<void>;
}
