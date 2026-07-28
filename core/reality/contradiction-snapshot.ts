import type { EntityId } from "../life/value-objects/entity-id";
import type { LifeDomainType } from "../life/value-objects/life-domain-type";

/**
 * Proyección mínima de una `Contradiction` (`core/contradiction-engine`)
 * -- mismo criterio que `RealityReasoningConclusion`: `core/reality` es
 * kernel compartido, nunca importa el tipo real del engine. Solo
 * `description`/`domain`, no `left`/`right`/`kind` -- lo que
 * `ConversationStrategyEngine` necesita para nombrar la tensión y
 * escribir el directive, no la trazabilidad completa (esa vive en
 * `contradictions`, para quien la explore explícitamente en `/life`).
 */
export interface RealityContradiction {
  id: EntityId;
  description: string;
  domain?: LifeDomainType;
}

/**
 * Contradicciones abiertas (`status: "open" | "acknowledged"`) ya
 * detectadas por `core/contradiction-engine` -- ausencia real
 * representada como ausencia (`items: []`), mismo criterio que el
 * resto de `core/reality`. Deliberadamente lo más reciente primero y
 * acotado a como máximo una (ver `assembleRealitySnapshot`): traer más
 * de una tensión abierta a la vez a un solo turno de conversación se
 * sentiría como una acumulación de cargos, no como acompañamiento.
 */
export interface ContradictionContextSnapshot {
  items: RealityContradiction[];
}
