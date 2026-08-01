import type { LifeDomainType } from "../../../core/life/value-objects/life-domain-type";
import type { IdentityConfidence } from "./identity-confidence";
import type { IdentityMomentum } from "./identity-momentum";
import type { IdentityRepresentation } from "./identity-representation";

/**
 * Lectura evolutiva de una de las 8 áreas de vida (`LifeDomainType`,
 * "wheel of life") -- el grano GRUESO de identidad. Siempre las 8
 * existen en `IdentitySnapshot.dimensions`, incluso con `weight: 0`
 * (una dimensión sin evidencia real sigue siendo un hecho legítimo:
 * "LUZ todavía no sabe nada de esto", nunca se omite -- Principio 1 del
 * motor: nunca fingir que existe evidencia que no hay).
 *
 * Nunca se borra, nunca desaparece del arreglo -- lo único que cambia
 * con el tiempo es `weight`/`momentum` (ver `services/compute-unit-timeline.ts`).
 * La creencia/evidencia original detrás de esto sigue intacta en
 * `core/belief-engine`; esto es una REPRESENTACIÓN derivada en cada
 * consulta, nunca un estado propio persistido (mismo principio que
 * `RealitySnapshot`: no es un log, se recalcula).
 */
export interface IdentityDimension {
  readonly domain: LifeDomainType;
  readonly label: string;

  /** 0-100 -- cuánto domina esta área la identidad actual de la persona, evidencia reciente pesando más que evidencia vieja. Ver `services/decay.ts`. */
  readonly weight: number;
  /** 0-100 -- el `weight` más alto que esta dimensión alcanzó dentro de la ventana evaluada (`IdentitySnapshot.lookbackDays`), sin importar cuánto haya caído después. La prueba de que "esto SÍ fue importante alguna ves", nunca se pierde aunque `weight` caiga a 0. */
  readonly peakWeight: number;
  /** `weight` tal como se habría leído hace `comparisonWindowDays` (ver `IdentitySnapshot`), usando solo evidencia que ya existía en ese momento -- nunca recalculado con datos futuros a ese punto. */
  readonly weightAtComparisonCheckpoint: number;
  /** `weight - weightAtComparisonCheckpoint`. Puede ser negativo. */
  readonly delta: number;

  readonly momentum: IdentityMomentum;
  /** `momentum` tal como se habría clasificado en el checkpoint de comparación (`now - comparisonWindowDays`), con su propia ventana de comparación recursiva -- lo que permite a `detect-shifts.ts` decidir si hubo una transición real sin volver a tocar evidencia cruda. */
  readonly previousMomentum: IdentityMomentum;
  readonly confidence: IdentityConfidence;

  /** Días desde la evidencia más antigua dentro de la ventana evaluada, o `null` si no hay ninguna. */
  readonly earliestEvidenceAgeDays: number | null;
  /** Días desde la evidencia más reciente, o `null` si no hay ninguna. */
  readonly latestEvidenceAgeDays: number | null;
  readonly evidenceCount: number;

  readonly representation: IdentityRepresentation;
}
