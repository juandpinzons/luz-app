import type { EntityType } from "../db/schema";
import type { UserContext } from "../identity/user-context";

/**
 * Forma de un trabajo en `knowledge_jobs` (`jobs.ts`) — no el contexto
 * del pipeline en sí, ese es `core/knowledge-engine/pipeline-context.ts`
 * (`LifeGraphContext & { memoryId }`). Este tipo sobrevive al retiro
 * del pipeline legado (`core/knowledge/pipeline/*`, `knowledge-engine.ts`)
 * porque `enqueueKnowledgeJob` (la cola) es infraestructura compartida,
 * no lógica de pipeline — sigue extendiendo `UserContext` porque
 * `knowledge_jobs.userId` es lo único que la fila necesita guardar; el
 * worker resuelve el `LifeGraphContext` real a partir de ahí
 * (`worker/index.ts`).
 */
export interface PipelineContext extends UserContext {
  sourceType: EntityType;
  sourceId: string;
}
