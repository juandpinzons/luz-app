import type { EntityId } from "../value-objects/entity-id";

/**
 * Forma común de los eventos de dominio de `core/life` (ver
 * ADR-0007: los engines se comunican vía eventos, no acoplamiento
 * directo). `type` es el discriminante que usan los subscribers para
 * hacer pattern matching.
 *
 * `lifeGraphId` y `personId` viven en el sobre del evento, no en cada
 * payload (ADR-0011): todo evento ocurre dentro de un LifeGraph y es
 * atribuible a un miembro específico — duplicarlos por evento sería
 * repetir lo mismo en cada uno de los tipos de abajo.
 */
export interface DomainEvent<TType extends string, TPayload> {
  id: EntityId;
  type: TType;
  lifeGraphId: EntityId;
  personId: EntityId;
  occurredAt: Date;
  payload: TPayload;
}
