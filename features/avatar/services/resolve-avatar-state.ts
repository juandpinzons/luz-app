import type { AvatarAnimation } from "../domain/avatar-animation";
import type { AvatarInteractionSignal } from "../domain/avatar-interaction-signal";
import type { AvatarMoodSignal } from "../domain/avatar-mood-signal";
import type { PresenceAvatarState } from "../domain/presence-avatar-state";

/** Sin actividad real por esto -- suficiente para que un silencio real (no solo una pausa entre teclas) cuente, mismo umbral de orden de magnitud que `DECAY_WINDOW_DAYS`/`RECENCY_WINDOW_DAYS` usan en otros módulos para "esto ya no es ruido". */
const SLEEP_INACTIVITY_MS = 5 * 60 * 1000;
/** Horas locales que cuentan como "de noche" para dormir -- mismo criterio de franja que `OrbTimeOfDay`. */
const SLEEP_HOURS = new Set([0, 1, 2, 3, 4, 5]);

function isSleepTime(interaction: AvatarInteractionSignal): boolean {
  return interaction.msSinceLastActivity >= SLEEP_INACTIVITY_MS && SLEEP_HOURS.has(interaction.localHour);
}

/** Animación de reposo/disparo por defecto para cada emoción -- ver docblock de `AvatarAnimation` para por qué esto no incluye `breathe`/`blink` (loops involuntarios que I7 controla aparte). */
function ambientAnimationFor(emotion: AvatarMoodSignal["emotion"]): AvatarAnimation {
  if (emotion === "celebrating") return "jump";
  if (emotion === "attentive") return "nod";
  return "idle";
}

/**
 * Combina la mitad determinística (`AvatarMoodSignal`, agregado de
 * días/meses) con la mitad en vivo (`AvatarInteractionSignal`, esta
 * sesión, ahora mismo) en el contrato final que un componente de
 * render consume. Prioridad, de mayor a menor:
 *
 * 1. La IA está respondiendo ahora mismo -> `animation: "think"` --
 *    esto SIEMPRE se nota, sin importar qué tan calmo o urgente sea el
 *    resto del día.
 * 2. La persona está escribiendo -> `animation: "listen"`, mirada
 *    siempre en `"user"` (escuchar de verdad significa mirar a quien
 *    habla, sin importar qué `gaze` hubiera elegido `mood`).
 * 3. Silencio real Y hora de la noche -> `animation: "sleep"`, emoción
 *    se relaja a `"calm"` (dormir con una expresión de celebración
 *    activa se vería incoherente).
 * 4. Nada de lo anterior -> la animación ambiente que corresponde a
 *    `mood.emotion` (ver `ambientAnimationFor`).
 *
 * Puro y determinístico -- mismos `mood` + `interaction` siempre
 * producen el mismo `PresenceAvatarState`.
 */
export function resolveAvatarState(
  mood: AvatarMoodSignal,
  interaction: AvatarInteractionSignal,
): PresenceAvatarState {
  if (interaction.isAiResponding) {
    return {
      emotion: mood.emotion,
      animation: "think",
      intensity: mood.intensity,
      gaze: mood.gaze,
      focusRef: mood.focusRef,
      reason: `${mood.reason} (generando una respuesta ahora mismo).`,
    };
  }

  if (interaction.isUserTyping) {
    return {
      emotion: mood.emotion,
      animation: "listen",
      intensity: mood.intensity,
      gaze: "user",
      focusRef: mood.focusRef,
      reason: `${mood.reason} (escuchando activamente).`,
    };
  }

  if (isSleepTime(interaction)) {
    return {
      emotion: "calm",
      animation: "sleep",
      intensity: 0.1,
      gaze: "away",
      focusRef: null,
      reason: "Inactividad real prolongada durante horas de la noche.",
    };
  }

  return {
    emotion: mood.emotion,
    animation: ambientAnimationFor(mood.emotion),
    intensity: mood.intensity,
    gaze: mood.gaze,
    focusRef: mood.focusRef,
    reason: mood.reason,
  };
}
