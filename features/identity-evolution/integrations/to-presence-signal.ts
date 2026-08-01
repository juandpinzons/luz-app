import type { LifeDomainType } from "../../../core/life/value-objects/life-domain-type";
import type { IdentityMomentum } from "../domain/identity-momentum";
import type { IdentitySnapshot } from "../domain/identity-snapshot";

export interface IdentityPresenceSignal {
  readonly suggestedFocusDomain: LifeDomainType | null;
  readonly deemphasizeDomains: readonly LifeDomainType[];
  readonly primaryLabel: string | null;
  /** `momentum` de `primaryIdentity` -- `null` cuando no hay una identidad principal todavía. Calibra tono: un `primaryFocus` recién `emerging` pide un saludo distinto de uno `stable` desde hace meses. */
  readonly primaryMomentum: IdentityMomentum | null;
}

/**
 * `IdentitySnapshot` -> señal para `features/presence/` -- misión: la
 * Capa de Presencia es uno de los cuatro consumidores explícitos.
 * Mismo criterio que `toPresenceContinuitySignal`
 * (`features/narrative/integrations/`): contrato listo, sin wiring
 * todavía (ningún import real desde `features/presence/`, verificado).
 */
export function toIdentityPresenceSignal(snapshot: IdentitySnapshot): IdentityPresenceSignal {
  return {
    suggestedFocusDomain: snapshot.presenceGuidance.suggestedFocusDomain,
    deemphasizeDomains: snapshot.presenceGuidance.deemphasizeDomains,
    primaryLabel: snapshot.primaryIdentity?.label ?? null,
    primaryMomentum: snapshot.primaryIdentity?.momentum ?? null,
  };
}
