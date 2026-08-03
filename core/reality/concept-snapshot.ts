import type { EntityId } from "../life/value-objects/entity-id";
import type { LifeDomainType } from "../life/value-objects/life-domain-type";

/**
 * Proyección mínima de un `Concept` (`core/concept-graph`) -- una
 * abstracción semántica que ya aparece de forma recurrente en la vida
 * de la persona ("Disciplina", "Confianza"), no una interpretación
 * puntual (eso es `Insight`) ni una creencia consolidada (eso es
 * `Belief`). Sin `confidence`: `Concept` no lleva ese campo -- a
 * diferencia de `RealityGrowingBelief`, no hay una banda de certeza
 * que dosificar aquí, solo un tema que existe o no existe todavía.
 */
export interface RealityConcept {
  id: EntityId;
  label: string;
  domain?: LifeDomainType;
}

/**
 * Identidad de fondo (`METADATA_INVENTORY_V1.md`, categoría Identidad):
 * temas/rasgos que ya definen a esta persona, no una lista completa --
 * quien la construye (`assembleRealitySnapshot`) decide cuántos y
 * cuáles, mismo criterio de acotar antes del ensamblador que ya rige
 * `memory`/`insights`. Ausencia real representada como ausencia.
 */
export interface ConceptSnapshot {
  items: RealityConcept[];
}
