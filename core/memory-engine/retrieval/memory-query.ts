import type { EntityId } from "../../life/value-objects/entity-id";
import type { MemoryType } from "../value-objects/memory-type";

/** Forma de una búsqueda de memorias — no cómo se ejecuta, ver `MemoryRetrievalStrategy`. */
export interface MemoryQuery {
  text?: string;
  type?: MemoryType;
  personId?: EntityId;
  occurredAfter?: Date;
  occurredBefore?: Date;
  limit?: number;
}
