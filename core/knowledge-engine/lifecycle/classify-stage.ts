import type { InsightType } from "../value-objects/insight-type";
import type { ExtractedItem } from "./extract-stage";
import type { PipelineContext } from "../pipeline-context";

export interface ClassifiedItem extends ExtractedItem {
  type: InsightType;
  /** Relevancia estimada, 0-100. */
  importance: number;
}

export interface ClassifyStage {
  classify(
    items: ExtractedItem[],
    context: PipelineContext,
  ): Promise<ClassifiedItem[]>;
}
