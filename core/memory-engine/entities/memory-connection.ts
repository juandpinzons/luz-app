import type { EntityId } from "../../life/value-objects/entity-id";

/**
 * Arista entre dos memorias, producida por la etapa Connect del
 * lifecycle. Es el material crudo sobre el que, más adelante, el
 * Knowledge Engine construye significado — Connect solo relaciona
 * evidencia, no la interpreta.
 */
export interface MemoryConnection {
  id: EntityId;
  lifeGraphId: EntityId;
  fromMemoryId: EntityId;
  toMemoryId: EntityId;
  /** Fuerza de la conexión, 0-100. */
  strength?: number;
  createdAt: Date;
}
