import type { LifeGraphContext } from "../../life/life-graph-context";
import type { MemoryType } from "../value-objects/memory-type";

/**
 * Determina el `MemoryType` de contenido crudo cuando `capture` no lo
 * recibe explícito. Distinto del `ClassifyStage` de Knowledge
 * (`core/knowledge/pipeline/classify.ts`): ese clasifica insights ya
 * derivados en `InsightType`; este clasifica evidencia cruda al
 * capturarla, antes de que exista ningún insight.
 */
export interface MemoryClassifier {
  classify(context: LifeGraphContext, content: string): Promise<MemoryType>;
}
