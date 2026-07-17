import type { LifeGraphContext } from "../life/life-graph-context";
import type { EntityId } from "../life/value-objects/entity-id";

/**
 * Contexto compartido por todo el pipeline. Extiende `LifeGraphContext`
 * en vez de duplicar `lifeGraphId`/`personId` — el Knowledge Engine
 * sigue el mismo contrato de identidad que el resto del dominio
 * (ADR-0011).
 *
 * `memoryId` identifica qué memoria disparó esta corrida — el
 * contenido a interpretar (`RealitySnapshot`, `core/reality`) se pasa
 * explícito a `ExtractStage.extract`, no aquí: el contexto lleva
 * identidad y alcance, no los datos que se están procesando (ADR-0013).
 */
export interface PipelineContext extends LifeGraphContext {
  memoryId: EntityId;
}
