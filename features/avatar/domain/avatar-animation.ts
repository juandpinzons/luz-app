/**
 * La MOTION del cuerpo -- distinta de `AvatarEmotion` (la expresión de
 * la cara) a propósito: un rig de personaje real (Rive/Lottie) separa
 * "cara"/"cuerpo" en capas de animación independientes que se combinan,
 * no una sola variable que las mezcle todas (ver README, "Guía de
 * integración para I7"). Dos familias:
 *
 * - **Ambiente** (`idle`) -- el loop de reposo. `breathe`/`blink` del
 *   boceto original NO son estados propios aquí: son micro-loops
 *   involuntarios que I7 dispara con su propio temporizador MIENTRAS
 *   el personaje está en cualquier estado (igual que un parpadeo real
 *   no depende de en qué esté pensando la persona) -- nunca algo que
 *   este backend deba decidir explícitamente.
 * - **Disparadas** (`wave`/`jump`/`hug`/`nod`) -- animaciones de un solo
 *   disparo cuando `emotion` cambia a algo que las justifica.
 * - **Interacción en vivo** (`listen`/`think`/`sleep`) -- nunca
 *   derivadas de Presence/Experience/Narrative/Identity (esos son
 *   agregados de días/meses); vienen de `AvatarInteractionSignal`, el
 *   estado real de la sesión actual (¿la persona está escribiendo?,
 *   ¿la IA está generando?, ¿cuánto silencio real hay?).
 */
export const AVATAR_ANIMATIONS = [
  "idle",
  "wave",
  "jump",
  "hug",
  "nod",
  "listen",
  "think",
  "sleep",
] as const;

export type AvatarAnimation = (typeof AVATAR_ANIMATIONS)[number];
