import type { LifeDomainType } from "../life/value-objects/life-domain-type";

/**
 * Proyección mínima de qué área/tema ya no debería dominar la
 * conversación -- fuente real: `features/identity-evolution`
 * (`IdentitySnapshot.deemphasized[0]`, una dimensión o tema
 * históricamente fuerte que ya está `dormant`/`declining`), traducido
 * aquí por `assembleRealitySnapshot` (única frontera anti-corrupción
 * permitida: `core/reality` nunca importa de `features/*`, así que
 * esta forma neutral es lo único que cruza). `statement` es la
 * etiqueta ya humana de esa dimensión/tema, nunca texto generado de
 * nuevo aquí.
 */
export interface RealityFadingBelief {
  statement: string;
  domain?: LifeDomainType;
  confidence: number;
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
