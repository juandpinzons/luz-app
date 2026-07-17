import type { EntityId } from "../../life/value-objects/entity-id";

/**
 * Un `Insight` nunca es texto libre: siempre apunta a la memoria
 * concreta que lo sustenta. `memoryId` es un `EntityId` — Knowledge no
 * importa ningún tipo de `core/memory-engine`, ni siquiera para esto
 * (ADR-0013): el id ya es el tipo compartido, y es lo único que un
 * registro persistido necesita conservar.
 */
export interface Evidence {
  id: EntityId;
  lifeGraphId: EntityId;
  insightId: EntityId;
  memoryId: EntityId;
  createdAt: Date;
}
