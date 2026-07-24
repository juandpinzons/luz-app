import type { Database } from "../../db/client";
import type { RealitySnapshot } from "../../reality/reality-snapshot";
import { AIInsightGenerationStrategy } from "../generation/ai-insight-generation-strategy";
import { DefaultExtractStage } from "../lifecycle/default-extract-stage";
import { DefaultPersistStage } from "../lifecycle/default-persist-stage";
import { DeterministicClassifyStage } from "../lifecycle/deterministic-classify-stage";
import type { PipelineContext } from "../pipeline-context";
import { StructuralInsightRelationshipStrategy } from "../relationships/structural-insight-relationship-strategy";
import { DrizzleInsightRepository } from "../repositories/drizzle-insight.repository";
import { DeterministicInsightValidationStrategy } from "../validation/deterministic-insight-validation-strategy";
import type { KnowledgeEngine, KnowledgeEngineStages } from "./knowledge-engine";

/**
 * Orquesta el pipeline completo, siempre en el mismo orden (decisión
 * CTO #5, preservada del legado): Extract → Classify → Relate →
 * Generate → Validate → Persist. Mismo patrón que
 * `DefaultMemoryEngine` (`core/memory-engine`) — compone estrategias
 * inyectadas, nunca decide lógica de negocio por sí misma.
 */
export class DefaultKnowledgeEngine implements KnowledgeEngine {
  constructor(private readonly stages: KnowledgeEngineStages) {}

  async run(snapshot: RealitySnapshot, context: PipelineContext): Promise<void> {
    const extracted = await this.stages.extract.extract(snapshot, context);
    const classified = await this.stages.classify.classify(extracted, context);
    const related = await this.stages.relate.relate(snapshot, classified, context);
    const generated = await this.stages.generate.generate(related, context);
    const validated = await this.stages.validate.validate(generated, context);
    await this.stages.persist.persist(validated, context);
  }
}

/**
 * Cierra el ciclo completo del Knowledge Engine (P0, cierre del Alpha):
 * las cuatro etapas ya deterministas (Classify, Relate, Validate,
 * Persist) más las dos que faltaban (Extract, Generate — ver
 * `default-extract-stage.ts` y `ai-insight-generation-strategy.ts`).
 * Reemplaza por completo a `core/knowledge/knowledge-engine.ts`
 * (legado, retirado) — no coexisten.
 */
export function createKnowledgeEngine(db: Database): KnowledgeEngine {
  return new DefaultKnowledgeEngine({
    extract: new DefaultExtractStage(),
    classify: new DeterministicClassifyStage(),
    relate: new StructuralInsightRelationshipStrategy(),
    generate: new AIInsightGenerationStrategy(),
    validate: new DeterministicInsightValidationStrategy(),
    persist: new DefaultPersistStage(new DrizzleInsightRepository(db)),
  });
}
