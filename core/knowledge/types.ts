import type { EntityType, InsightType } from "../db/schema";

/** Contexto compartido por todas las etapas del pipeline. */
export interface PipelineContext {
  userId: string;
  sourceType: EntityType;
  sourceId: string;
}

export interface ExtractedItem {
  /** Fragmento de información relevante extraído de la fuente cruda. */
  text: string;
}

export interface ClassifiedItem extends ExtractedItem {
  type: InsightType;
  /** Relevancia estimada, 0-100. */
  importance: number;
}

export interface RelatedEntityRef {
  type: EntityType;
  id: string;
}

export interface RelatedItem extends ClassifiedItem {
  relatedEntities: RelatedEntityRef[];
}

/** Lo que el LLM propone. Todavía no es conocimiento persistido. */
export interface GeneratedInsight {
  type: InsightType;
  description: string;
  proposedConfidence: number;
  evidence: RelatedEntityRef[];
}

/**
 * Lo que el Knowledge Engine decide después de validar. El LLM propone;
 * LUZ decide — `confidence` y `status` los asigna esta etapa, nunca el
 * LLM directamente.
 */
export interface ValidatedInsight extends GeneratedInsight {
  confidence: number;
  status: "validated" | "rejected";
}

export interface ExtractStage {
  extract(context: PipelineContext): Promise<ExtractedItem[]>;
}

export interface ClassifyStage {
  classify(
    items: ExtractedItem[],
    context: PipelineContext,
  ): Promise<ClassifiedItem[]>;
}

export interface RelateStage {
  relate(
    items: ClassifiedItem[],
    context: PipelineContext,
  ): Promise<RelatedItem[]>;
}

export interface GenerateStage {
  generate(
    items: RelatedItem[],
    context: PipelineContext,
  ): Promise<GeneratedInsight[]>;
}

export interface ValidateStage {
  validate(
    insights: GeneratedInsight[],
    context: PipelineContext,
  ): Promise<ValidatedInsight[]>;
}

export interface PersistStage {
  persist(
    insights: ValidatedInsight[],
    context: PipelineContext,
  ): Promise<void>;
}
