import type { ExperienceState } from "../../experience/domain/experience-state";
import type { IdentitySnapshot } from "../../identity-evolution/domain/identity-snapshot";
import type { NarrativeState } from "../../narrative/domain/narrative-state";
import type { PresenceState } from "../../presence/domain/presence-state";
import { NEUTRAL_INTERACTION_SIGNAL, type AvatarInteractionSignal } from "../domain/avatar-interaction-signal";
import type { PresenceAvatarState } from "../domain/presence-avatar-state";
import { deriveMood } from "../services/derive-mood";
import { resolveAvatarState } from "../services/resolve-avatar-state";

export interface BuildPresenceAvatarStateInput {
  readonly presence: PresenceState;
  readonly experience: ExperienceState;
  readonly narrative: NarrativeState;
  readonly identity: IdentitySnapshot;
  /** Por defecto, `NEUTRAL_INTERACTION_SIGNAL` -- un caller de servidor (sin sesión de UI en vivo) puede omitirlo por completo. */
  readonly interaction?: AvatarInteractionSignal;
  readonly now?: Date;
}

/**
 * Punto de entrada público del módulo -- `deriveMood` +
 * `resolveAvatarState` en un solo paso, mismo criterio de conveniencia
 * que `buildOrbVisualState` (`features/orb/application/build-orb-state.ts`).
 * Consume SOLO los cuatro contratos públicos que pide la misión
 * (`PresenceState`/`ExperienceState`/`NarrativeState`/`IdentitySnapshot`,
 * ya calculados por sus propios módulos) -- nunca un repositorio, nunca
 * IA, nunca aleatoriedad. Determinístico de punta a punta.
 */
export function buildPresenceAvatarState(input: BuildPresenceAvatarStateInput): PresenceAvatarState {
  const mood = deriveMood({
    presence: input.presence,
    experience: input.experience,
    narrative: input.narrative,
    identity: input.identity,
    now: input.now,
  });
  return resolveAvatarState(mood, input.interaction ?? NEUTRAL_INTERACTION_SIGNAL);
}
