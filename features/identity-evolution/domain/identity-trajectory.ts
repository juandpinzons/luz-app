/**
 * Hacia dónde se mueve la identidad de la persona COMO UN TODO -- nivel
 * snapshot, no por dimensión/tema (para eso ver `IdentityMomentum`).
 *
 * - `consolidating` -- el mismo `IdentityDimension`/`IdentityTheme`
 *   sigue en el puesto #1 (`IdentitySnapshot.primaryIdentity`) que hace
 *   `comparisonWindowDays`. La identidad principal de la persona no
 *   cambió de dueño recientemente, esté o no ese #1 en pleno
 *   crecimiento.
 * - `transitioning` -- el puesto #1 cambió de dueño en la misma
 *   ventana. La persona está, de forma real y medible, convirtiéndose
 *   en alguien distinto ahora mismo (ej. de "recuperación" a
 *   "construyendo LUZ").
 * - `insufficient_evidence` -- todavía no hay suficiente historia para
 *   afirmar ninguna de las dos anteriores (ej. cuenta nueva, o ningún
 *   `IdentityDimension`/`IdentityTheme` cruza el umbral mínimo de
 *   presencia). Nunca se fuerza `consolidating` por defecto -- Principio
 *   1 del motor: nunca afirmar más certeza de la que hay.
 */
export const IDENTITY_TRAJECTORY_STATES = [
  "consolidating",
  "transitioning",
  "insufficient_evidence",
] as const;

export type IdentityTrajectoryState = (typeof IDENTITY_TRAJECTORY_STATES)[number];

export interface IdentityTrajectory {
  readonly state: IdentityTrajectoryState;
  /** Clave (`domain` o `themeKey`) del #1 actual, o `null` si no hay ninguno elegible. */
  readonly primaryKey: string | null;
  /** Clave del #1 en el checkpoint de comparación, o `null`. */
  readonly previousPrimaryKey: string | null;
  readonly description: string;
}
