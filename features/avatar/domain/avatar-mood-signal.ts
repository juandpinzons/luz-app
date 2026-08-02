import type { AvatarEmotion } from "./avatar-emotion";
import type { AvatarGazeTarget } from "./avatar-gaze";

/**
 * Qué disparó `emotion`/`gaze` -- referencia semántica mínima (nunca el
 * objeto completo, nunca un id opaco sin contexto), mismo criterio que
 * `ObservationEntityRef`/`NarrativeRelatedEntity`: suficiente para que
 * un consumidor sepa DE QUÉ está hablando el personaje, sin acoplarse
 * a la forma interna de Presence/Experience/Narrative/Identity.
 */
export interface AvatarFocusRef {
  readonly kind: "presence_focus" | "experience_card" | "narrative_thread" | "identity_theme" | "identity_dimension";
  readonly title: string;
}

/**
 * La mitad determinística de `PresenceAvatarState` -- derivada
 * EXCLUSIVAMENTE de `PresenceState` + `ExperienceState` + `NarrativeState`
 * + `IdentitySnapshot` (los cuatro que pide la misión), en un instante
 * dado (`asOf`). Nunca conoce interacción en vivo (typing/streaming/
 * inactividad) -- eso es `AvatarInteractionSignal`, una capa aparte a
 * propósito (ver README): esos cuatro motores son agregados de
 * días/meses, nunca podrían responder honestamente "¿la persona está
 * escribiendo ahora mismo?".
 */
export interface AvatarMoodSignal {
  readonly emotion: AvatarEmotion;
  /** 0-1, qué tan pronunciada debería verse la expresión/animación. */
  readonly intensity: number;
  readonly gaze: AvatarGazeTarget;
  /** `null` cuando `gaze === "user"` o `"away"` -- nunca inventado para `"highlight"`. */
  readonly focusRef: AvatarFocusRef | null;
  /** Explicación determinista y legible -- Principio 3 del motor: toda expresión debe poder justificarse con evidencia real. */
  readonly reason: string;
  readonly asOf: Date;
}
