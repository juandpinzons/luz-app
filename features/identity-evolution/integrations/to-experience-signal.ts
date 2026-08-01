import type { EntityId } from "../../../core/life/value-objects/entity-id";
import type { IdentitySnapshot } from "../domain/identity-snapshot";

export interface IdentityExperienceSignal {
  readonly spotlightThemeKey: EntityId | null;
  readonly retireThemeKeys: readonly string[];
  /** `true` cuando `recentShifts` no está vacío -- una identidad que acaba de cambiar de forma real es, en sí misma, candidata a "qué cambió" (`ExperienceState.whatChanged`), sin que Experience tenga que reimplementar la comparación. */
  readonly hasRecentIdentityShift: boolean;
}

/**
 * `IdentitySnapshot` -> señal para `features/experience/` -- misión: la
 * capa de Experiencia es uno de los cuatro consumidores explícitos.
 * Mismo criterio que el resto de `integrations/`: contrato listo, sin
 * wiring todavía (ningún import real desde `features/experience/`,
 * verificado).
 */
export function toIdentityExperienceSignal(snapshot: IdentitySnapshot): IdentityExperienceSignal {
  return {
    spotlightThemeKey: snapshot.experienceGuidance.spotlightThemeKey,
    retireThemeKeys: snapshot.experienceGuidance.retireThemeKeys,
    hasRecentIdentityShift: snapshot.recentShifts.length > 0,
  };
}
