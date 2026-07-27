import type { EntityId } from "../../../life/value-objects/entity-id";

/**
 * El conjunto candidato de insights sobre el que el Reasoning Engine
 * puede correlacionar y razonar -- ya resuelto a ids concretos por
 * quien arma la ventana, nunca decidido dentro de este engine (ver
 * `ReasoningGatherStage`, que solo resuelve ids → `Insight`s reales).
 *
 * Hoy la única fuente real es `Context` (`core/context-engine`, lo que
 * Context Engine ya decidió relevante para el turno de chat actual --
 * ver `toReasoningEvidenceWindow` en
 * `features/knowledge/services/enrich-knowledge-graph.ts`, el único
 * lugar que sabe que esa es la fuente de hoy). Este engine mismo nunca
 * importa `core/context-engine`: `Gather` solo conoce esta forma
 * neutral, exactamente el mismo límite anti-corrupción que ya aplica
 * `core/reality` frente a `core/life`/`core/memory-engine` (ADR-0013).
 *
 * Por qué esto importa para crecer: una ventana de razonamiento más
 * amplia -- Top N por `core/importance-engine` en todo el LifeGraph, o
 * un recorrido del grafo de `core/concept-graph`/`core/belief-engine` --
 * es, desde este punto en adelante, exactamente lo mismo: otra función
 * que produce un `ReasoningEvidenceWindow`, nunca un cambio a
 * `Gather`/`Correlate`/`Reason`/`Validate`/`Persist` ni al
 * orquestador. Swapear la fuente es swapear qué función se llama en
 * `enrich-knowledge-graph.ts`, no tocar `core/knowledge-engine/reasoning`.
 */
export interface ReasoningEvidenceWindow {
  insightIds: EntityId[];
}
