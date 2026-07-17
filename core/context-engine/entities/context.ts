import type { EntityId } from "../../life/value-objects/entity-id";
import type { ContextItemSource } from "../value-objects/context-item-source";

/**
 * Un elemento de realidad que Context Engine consideró relevante.
 * `sourceId` referencia la entidad de origen dentro de su propia
 * sección de `RealitySnapshot` (un goal, una memoria...) — opcional
 * porque las señales externas (`ExternalSignal`, `core/reality`)
 * todavía no tienen id propio.
 */
export interface ContextItem {
  sourceId?: EntityId;
  source: ContextItemSource;
  label: string;
  /** 0-100. */
  relevanceScore: number;
}

/**
 * Lo más relevante ahora mismo (CONTEXT_ENGINE_SPEC.md) — el output de
 * Context Engine, nunca su input (ese es `RealitySnapshot`, ADR-0013).
 * Su propio aggregate root, igual que `Memory`/`Insight`: Context
 * opera SOBRE un LifeGraph, nunca es miembro del aggregate `LifeGraph`
 * (ADR-0011).
 */
export interface Context {
  id: EntityId;
  lifeGraphId: EntityId;
  items: ContextItem[];
  generatedAt: Date;
}
