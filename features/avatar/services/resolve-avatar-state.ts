import type { AvatarAnimation } from "../domain/avatar-animation";
import type { AvatarEmotion } from "../domain/avatar-emotion";
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

/** El gesto de un solo disparo que corresponde a ENTRAR a esta emoción -- `null` para las que no tienen uno propio todavía (`calm`/`happy`/`curious` se asientan directo en `idle`, sin fingir un gesto que la misión no pidió). */
function gestureFor(emotion: AvatarEmotion): AvatarAnimation | null {
  if (emotion === "celebrating") return "jump";
  if (emotion === "attentive") return "nod";
  return null;
}

function baseState(
  mood: AvatarMoodSignal,
  animation: AvatarAnimation,
  overrides: { gaze?: PresenceAvatarState["gaze"]; reasonSuffix?: string } = {},
): PresenceAvatarState {
  return {
    emotion: mood.emotion,
    animation,
    intensity: mood.intensity,
    gaze: overrides.gaze ?? mood.gaze,
    focusRef: mood.focusRef,
    reason: overrides.reasonSuffix ? `${mood.reason} (${overrides.reasonSuffix}).` : mood.reason,
  };
}

/**
 * Combina la mitad determinística (`AvatarMoodSignal`, agregado de
 * días/meses) con la mitad en vivo (`AvatarInteractionSignal`, esta
 * sesión, ahora mismo) en el contrato final que un componente de
 * render consume. Jerarquía de interrupción estricta, de mayor a
 * menor prioridad -- documentada en detalle en el README ("¿Qué
 * interrumpe qué?"):
 *
 * 1. `reducedMotion` -- nunca un gesto, sin importar todo lo demás.
 * 2. La IA está respondiendo -> `think`. Interrumpe cualquier gesto en
 *    curso sin esperar a que termine.
 * 3. La persona está escribiendo -> `listen`, mirada siempre en
 *    `"user"`. Misma prioridad de interrupción que 2.
 * 4. Silencio real de noche -> `sleep`, emoción se relaja a `calm` --
 *    EXCEPTO cuando `mood.emotion === "attentive"` (una urgencia real
 *    pendiente nunca se deja "dormir": ver README, "Qué nunca debe
 *    ocurrir").
 * 5. Nada de lo anterior: si la emoción ACABA de cambiar
 *    (`interaction.previousEmotion !== mood.emotion`), el gesto de
 *    entrada correspondiente (`gestureFor`) se dispara UNA VEZ; si ya
 *    se sostenía, se queda en `idle` -- nunca se repite un gesto en
 *    cada render mientras la emoción no cambia.
 *
 * Puro y determinístico -- mismos `mood` + `interaction` siempre
 * producen el mismo `PresenceAvatarState`. No corre ningún temporizador
 * propio: la duración de un gesto (`AVATAR_GESTURE_DURATION_MS`) es
 * responsabilidad de I7, nunca de este backend.
 */
export function resolveAvatarState(
  mood: AvatarMoodSignal,
  interaction: AvatarInteractionSignal,
): PresenceAvatarState {
  if (interaction.reducedMotion) {
    return baseState(mood, "idle", { reasonSuffix: "movimiento reducido activo" });
  }

  if (interaction.isAiResponding) {
    return baseState(mood, "think", { reasonSuffix: "generando una respuesta ahora mismo" });
  }

  if (interaction.isUserTyping) {
    return baseState(mood, "listen", { gaze: "user", reasonSuffix: "escuchando activamente" });
  }

  if (isSleepTime(interaction) && mood.emotion !== "attentive") {
    return {
      emotion: "calm",
      animation: "sleep",
      intensity: 0.1,
      gaze: "away",
      focusRef: null,
      reason: "Inactividad real prolongada durante horas de la noche.",
    };
  }

  const justEntered = interaction.previousEmotion === undefined || interaction.previousEmotion !== mood.emotion;
  const gesture = justEntered ? gestureFor(mood.emotion) : null;

  return baseState(mood, gesture ?? "idle");
}
