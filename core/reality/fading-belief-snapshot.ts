import type { EntityId } from "../life/value-objects/entity-id";
import type { LifeDomainType } from "../life/value-objects/life-domain-type";

/**
 * Proyección mínima de un `Belief` que dejó de sostenerse (`core/belief-engine`,
 * `status: "expired" | "retracted"`) -- la contraparte de
 * `RealityGrowingBelief`: en vez de algo que se está formando, algo que
 * ya se soltó. `since` es `belief.updatedAt` en el momento en que pasó
 * a este estado -- `decay-stale-beliefs.ts` es el único lugar que
 * transiciona un Belief a `expired`, y nunca vuelve a tocar una
 * creencia que ya no está `active`, así que `updatedAt` es de hecho el
 * momento exacto de la transición, no una aproximación.
 */
export interface RealityFadingBelief {
  id: EntityId;
  statement: string;
  domain?: LifeDomainType;
  confidence: number;
  since: Date;
}

/**
 * Como máximo una a la vez (mismo criterio que `GrowingBeliefSnapshot`/
 * `ContradictionContextSnapshot`) -- nombrar varios capítulos cerrados
 * en el mismo turno se sentiría como un repaso de fracasos, no como
 * acompañamiento. Ausencia real representada como ausencia.
 */
export interface FadingBeliefSnapshot {
  items: RealityFadingBelief[];
}
