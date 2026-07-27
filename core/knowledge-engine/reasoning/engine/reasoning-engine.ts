import type { Context } from "../../../context-engine";
import type { EntityId } from "../../../life/value-objects/entity-id";
import type { PipelineContext } from "../../pipeline-context";
import type { ReasoningConclusion } from "../entities/reasoning-conclusion";

/**
 * Único punto de acceso real -- mismo patrón que `KnowledgeEngine`/
 * `ContextEngine`. `memoryContentById` es la traducción neutral que el
 * llamador ya tiene lista (`RealitySnapshot.memory.items`, capa de
 * aplicación) -- este engine nunca importa `core/memory-engine`, mismo
 * límite que ya respeta `Evidence.memoryId` en el resto de
 * `core/knowledge-engine`.
 */
export interface ReasoningEngine {
  run(
    context: Context,
    pipelineContext: PipelineContext,
    memoryContentById: Map<EntityId, string>,
  ): Promise<ReasoningConclusion[]>;
}
