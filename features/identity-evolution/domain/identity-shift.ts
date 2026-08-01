import type { IdentityMomentum } from "./identity-momentum";

/**
 * Un cambio real y reciente en cómo se representa la identidad de la
 * persona -- el registro explícito de una TRANSICIÓN, a diferencia de
 * `IdentityMomentum`, que describe el estado de reposo actual. Se
 * genera exactamente cuando `momentum !== previousMomentum` al comparar
 * el mismo `IdentityDimension`/`IdentityTheme` en dos instantes
 * (`now` vs `now - comparisonWindowDays`) -- nunca inventado, nunca por
 * un único mensaje (`detectedOverDays` siempre documenta la ventana
 * real usada, ver `services/detect-shifts.ts`).
 */
export interface IdentityShift {
  readonly unitKind: "dimension" | "theme";
  /** `LifeDomainType` para dimensiones, `themeKey` (el `conceptId`) para temas. */
  readonly key: string;
  readonly label: string;
  readonly momentum: IdentityMomentum;
  readonly previousMomentum: IdentityMomentum;
  /** `weight` actual menos `weight` en el checkpoint de comparación -- puede ser negativo. */
  readonly delta: number;
  /** Cuántos días atrás se fijó el checkpoint de comparación -- mismo valor para todos los shifts de un mismo `IdentitySnapshot`. */
  readonly detectedOverDays: number;
  /** Explicación determinista, ej. "de estable a en declive: peso 74 -> 58 en 45 días". */
  readonly description: string;
}
