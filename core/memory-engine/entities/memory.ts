import type { EntityId } from "../../life/value-objects/entity-id";
import type { MemoryRank } from "../value-objects/memory-rank";
import type { MemorySource } from "../value-objects/memory-source";
import type { MemoryStatus } from "../value-objects/memory-status";
import type { MemoryType } from "../value-objects/memory-type";

/**
 * Evidencia cruda (MEMORY_ENGINE_SPEC.md: "Memory no razona"). Es su
 * propio aggregate root — Memory opera SOBRE un LifeGraph
 * (`lifeGraphId` es solo la frontera de tenencia), nunca es miembro
 * del aggregate `LifeGraph` (ADR-0011).
 *
 * `personId` es opcional: no toda memoria es atribuible a un miembro
 * específico del grafo (p. ej. una observación de un sensor).
 * `sourceId` es un id opaco a la fuente original (mensaje de
 * conversación, entrada de diario...) — Memory no interpreta su forma,
 * solo lo guarda como referencia.
 */
export interface Memory {
  id: EntityId;
  lifeGraphId: EntityId;
  personId?: EntityId;
  type: MemoryType;
  content: string;
  source: MemorySource;
  sourceId?: string;
  status: MemoryStatus;
  rank?: MemoryRank;
  occurredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
