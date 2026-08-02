import type { AvatarAnimation } from "./avatar-animation";
import type { AvatarEmotion } from "./avatar-emotion";
import type { AvatarGazeTarget } from "./avatar-gaze";
import type { AvatarFocusRef } from "./avatar-mood-signal";

/**
 * Contrato final -- lo único que un componente de render (I7) necesita
 * leer. Resultado de combinar `AvatarMoodSignal` (Presence+Experience+
 * Narrative+Identity, agregado) con `AvatarInteractionSignal` (sesión
 * en vivo) vía `resolveAvatarState` (`services/resolve-avatar-state.ts`)
 * -- determinístico de punta a punta: mismo `mood` + mismo
 * `interaction` siempre producen el mismo `PresenceAvatarState`.
 *
 * `focusRef`/`reason` no estaban en el boceto original de la misión --
 * se añaden porque cada expresión debe poder explicarse con evidencia
 * real (Principio 3 del motor, mismo criterio que
 * `IdentityRepresentation`/`NarrativeReason` en el resto del repo).
 * Ningún campo nuevo rompe los cuatro que sí pedía el boceto
 * (`emotion`/`animation`/`intensity`/`gaze`), que siguen presentes tal
 * cual.
 */
export interface PresenceAvatarState {
  readonly emotion: AvatarEmotion;
  readonly animation: AvatarAnimation;
  /** 0-1. */
  readonly intensity: number;
  readonly gaze: AvatarGazeTarget;
  readonly focusRef: AvatarFocusRef | null;
  readonly reason: string;
}
