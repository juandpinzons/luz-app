import type { EntityId } from "../life/value-objects/entity-id";

/**
 * Proyección mínima de un `ReasoningConclusion`
 * (`core/knowledge-engine/reasoning`) -- mismo criterio que
 * `RealityInsightItem`: `core/reality` es kernel compartido, nunca
 * importa el tipo real de ningún engine. Deliberadamente sin
 * `uncertaintyNotes`/evidencia aquí -- lo que necesita
 * `ConversationStrategyEngine` para decidir y explicar su postura es
 * la afirmación y qué tan sólida es, no el razonamiento completo
 * detrás (eso vive en `knowledge_engine_reasoning_evidence`, para
 * quien lo explore explícitamente, no para cada turno de conversación).
 */
export interface RealityReasoningConclusion {
  id: EntityId;
  statement: string;
  confidenceScore: number;
}

/** Conclusiones de razonamiento ya validadas, relevantes ahora -- mismo criterio de ausencia real que `InsightContextSnapshot`: sin ninguna, `items` queda vacío, nunca se rellena. */
export interface ReasoningContextSnapshot {
  items: RealityReasoningConclusion[];
}
