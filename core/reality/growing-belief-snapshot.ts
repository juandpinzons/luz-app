import type { EntityId } from "../life/value-objects/entity-id";

/**
 * Proyección mínima de un `Belief` cuya confianza todavía está en
 * formación (`core/belief-engine`) -- ni tan débil que sea ruido de
 * una sola mención, ni tan sólida que ya sea momento de compartirla
 * como comprensión asentada (eso es `ReflectStrategyRule`, que exige
 * `confidence >= 55`). `statement` tal cual la propuso la estrategia
 * de consolidación -- nunca reinterpretado aquí.
 */
export interface RealityGrowingBelief {
  id: EntityId;
  statement: string;
  confidence: number;
}

/**
 * Como máximo una hipótesis en formación a la vez (ver
 * `assembleRealitySnapshot`) -- mismo criterio que
 * `ContradictionContextSnapshot`/`CuriosityContextSnapshot`: confirmar
 * más de una a la vez se sentiría como un interrogatorio, no como
 * acompañamiento. Ausencia real representada como ausencia.
 */
export interface GrowingBeliefSnapshot {
  items: RealityGrowingBelief[];
}
