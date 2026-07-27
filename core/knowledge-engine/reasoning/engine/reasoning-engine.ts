import type { EntityId } from "../../../life/value-objects/entity-id";
import type { PipelineContext } from "../../pipeline-context";
import type { ReasoningConclusion } from "../entities/reasoning-conclusion";
import type { ReasoningEvidenceWindow } from "../gathering/reasoning-evidence-window";

/**
 * Único punto de acceso real -- mismo patrón que `KnowledgeEngine`/
 * `ContextEngine`. Recibe una `ReasoningEvidenceWindow` ya armada, no
 * un `Context` de Context Engine directamente -- ese acoplamiento vive
 * en quien arma la ventana (`enrich-knowledge-graph.ts`), nunca en
 * este contrato (ver docblock de `ReasoningEvidenceWindow` para el
 * porqué: es el punto exacto donde una ventana de razonamiento más
 * amplia se conecta a futuro, sin cambiar esta firma).
 * `memoryContentById` es la traducción neutral que el llamador ya
 * tiene lista (`RealitySnapshot.memory.items`, capa de aplicación) --
 * este engine nunca importa `core/memory-engine`, mismo límite que ya
 * respeta `Evidence.memoryId` en el resto de `core/knowledge-engine`.
 */
export interface ReasoningEngine {
  run(
    window: ReasoningEvidenceWindow,
    pipelineContext: PipelineContext,
    memoryContentById: Map<EntityId, string>,
  ): Promise<ReasoningConclusion[]>;
}
