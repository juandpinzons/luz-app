import type { Database } from "../db/client";
import { NotImplementedClassifyStage } from "./pipeline/classify";
import { NotImplementedExtractStage } from "./pipeline/extract";
import { NotImplementedGenerateStage } from "./pipeline/generate";
import { DrizzlePersistStage } from "./pipeline/persist";
import { NotImplementedRelateStage } from "./pipeline/relate";
import { NotImplementedValidateStage } from "./pipeline/validate";
import type {
  ClassifyStage,
  ExtractStage,
  GenerateStage,
  PersistStage,
  PipelineContext,
  RelateStage,
  ValidateStage,
} from "./types";

export interface KnowledgeEngineStages {
  extract: ExtractStage;
  classify: ClassifyStage;
  relate: RelateStage;
  generate: GenerateStage;
  validate: ValidateStage;
  persist: PersistStage;
}

/**
 * Orquesta el pipeline del conocimiento derivado, siempre en el mismo
 * orden explícito (decisión CTO #5):
 *
 *   Extract → Classify → Relate → Generate → Validate → Persist
 *
 * Se ejecuta exclusivamente desde el worker (nunca desde una ruta HTTP,
 * decisión CTO #6): el Knowledge Engine no sabe ni le importa quién lo
 * invoca, solo que se le da un `PipelineContext`.
 */
export class KnowledgeEngine {
  constructor(private readonly stages: KnowledgeEngineStages) {}

  async run(context: PipelineContext): Promise<void> {
    const extracted = await this.stages.extract.extract(context);
    const classified = await this.stages.classify.classify(
      extracted,
      context,
    );
    const related = await this.stages.relate.relate(classified, context);
    const generated = await this.stages.generate.generate(related, context);
    const validated = await this.stages.validate.validate(
      generated,
      context,
    );
    await this.stages.persist.persist(validated, context);
  }
}

export function createKnowledgeEngine(db: Database): KnowledgeEngine {
  return new KnowledgeEngine({
    extract: new NotImplementedExtractStage(),
    classify: new NotImplementedClassifyStage(),
    relate: new NotImplementedRelateStage(),
    generate: new NotImplementedGenerateStage(),
    validate: new NotImplementedValidateStage(),
    persist: new DrizzlePersistStage(db),
  });
}

export type { PipelineContext } from "./types";
