import type { EntityId } from "../../life/value-objects/entity-id";
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";

export const MOVEMENT_DIRECTIONS = ["strengthening", "weakening"] as const;
export type MovementDirection = (typeof MOVEMENT_DIRECTIONS)[number];

/**
 * Un solo cambio de confianza de un Belief, proyectado a su dominio --
 * la unidad mínima que `detect-domain-co-movement.ts` compara entre sí.
 * `beliefId`/`domain` viajan juntos para que, si se confirma un patrón,
 * se pueda recuperar evidencia real (el Belief y su propia evidencia)
 * sin adivinar cuál era.
 */
export interface DomainMovement {
  beliefId: EntityId;
  domain: LifeDomainType;
  direction: MovementDirection;
  changedAt: Date;
}
