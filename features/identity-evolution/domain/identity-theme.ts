import type { EntityId } from "../../../core/life/value-objects/entity-id";
import type { LifeDomainType } from "../../../core/life/value-objects/life-domain-type";
import type { IdentityConfidence } from "./identity-confidence";
import type { IdentityMomentum } from "./identity-momentum";
import type { IdentityRepresentation } from "./identity-representation";

/**
 * Lectura evolutiva de un `Concept` (`core/concept-graph`) -- el grano
 * FINO de identidad ("Construyendo LUZ", "Recuperación de ketamina"),
 * a diferencia de `IdentityDimension` (las 8 áreas amplias). Un
 * `Concept` YA es una abstracción semántica real (Principio de
 * `core/concept-graph`: distinto de un Insight puntual); `IdentityTheme`
 * no sintetiza un tema nuevo a partir de texto libre, solo envuelve un
 * `Concept` real con su propia evolución de peso.
 *
 * Solo existen temas para `Concept`s con al menos una `ConceptEvidence`
 * real dentro de la ventana evaluada -- igual que `IdentityDimension`,
 * un tema NUNCA se elimina del arreglo una vez que apareció aquí una
 * vez, aunque `weight` caiga a 0 (Principio central de la misión: la
 * historia nunca desaparece, deja de dominar).
 */
export interface IdentityTheme {
  /** `Concept.id` -- clave estable, nunca la etiqueta (que sí puede editarse vía `ConceptRepository.save()`). */
  readonly themeKey: EntityId;
  readonly conceptId: EntityId;
  readonly label: string;
  /** `Concept.domain` -- ausente cuando el concepto todavía no tiene un área de vida clasificada. */
  readonly domain?: LifeDomainType;

  readonly weight: number;
  readonly peakWeight: number;
  readonly weightAtComparisonCheckpoint: number;
  readonly delta: number;

  readonly momentum: IdentityMomentum;
  /** Ver el mismo campo en `IdentityDimension` -- misma semántica. */
  readonly previousMomentum: IdentityMomentum;
  readonly confidence: IdentityConfidence;

  readonly earliestEvidenceAgeDays: number | null;
  readonly latestEvidenceAgeDays: number | null;
  readonly evidenceCount: number;

  readonly representation: IdentityRepresentation;
}
