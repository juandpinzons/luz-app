import type { AvatarEmotion } from "./avatar-emotion";

/**
 * La mitad EN VIVO de `PresenceAvatarState` -- estado real de la sesión
 * actual, nunca derivable de Presence/Experience/Narrative/Identity
 * (esos son agregados de días/meses; esto es "ahora mismo, en esta
 * pestaña"). Responsabilidad de quien integra el componente (I7): leer
 * el estado real del cliente de chat/UI y construir esto en cada
 * render, no de este módulo.
 */
export interface AvatarInteractionSignal {
  /** La IA está generando/transmitiendo una respuesta ahora mismo (mismo estado que ya alimenta `components/ui/typing-indicator.tsx`). */
  readonly isAiResponding: boolean;
  /** La persona está escribiendo en el input ahora mismo. */
  readonly isUserTyping: boolean;
  /** Milisegundos desde la última actividad real (mensaje enviado, tecla presionada, navegación) -- mismo tipo de métrica que ya usa `orb-life-signals.ts`/`generate-welcome.ts` (`msSinceLastMessage`), aquí a nivel de sesión de UI en vez de conversación. */
  readonly msSinceLastActivity: number;
  /** Hora local 0-23 -- mismo criterio que `OrbTimeOfDay`, para decidir si el silencio actual cae en horas de la noche. */
  readonly localHour: number;
  /**
   * La `emotion` que `resolveAvatarState` devolvió la última vez que
   * I7 lo llamó -- NUNCA opcional-y-olvidado: sin esto, no hay forma
   * honesta de distinguir "la emoción ACABA de cambiar" (dispara un
   * gesto) de "la emoción sigue igual" (se queda en el loop). `undefined`
   * únicamente en el primer render real de la sesión, cuando de verdad
   * no hay historial -- ver README, "¿Cuánto dura una sonrisa?"/"Qué
   * nunca debe ocurrir" (un gesto nunca se repite en cada render).
   * Responsabilidad de I7: guardar `PresenceAvatarState.emotion` de la
   * respuesta anterior y pasarlo de vuelta aquí en la siguiente.
   */
  readonly previousEmotion?: AvatarEmotion;
  /** `prefers-reduced-motion` del cliente -- cuando es `true`, `resolveAvatarState` nunca devuelve un gesto (`wave`/`jump`/`hug`/`nod`), solo `idle`/`listen`/`think`/`sleep` (loops, sin movimiento expresivo de un solo disparo). Mismo criterio de accesibilidad que ya aplican `ConversationOpeningRitual`/`app/globals.css` para `features/orb/`. */
  readonly reducedMotion?: boolean;
}

/** Sin interacción en vivo que reportar -- todas las señales en su estado neutral. Punto de partida razonable para un primer render antes de que el cliente tenga datos reales. */
export const NEUTRAL_INTERACTION_SIGNAL: AvatarInteractionSignal = {
  isAiResponding: false,
  isUserTyping: false,
  msSinceLastActivity: 0,
  localHour: 12,
};
