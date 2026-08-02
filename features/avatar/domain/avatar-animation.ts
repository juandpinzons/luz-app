/**
 * La MOTION del cuerpo -- distinta de `AvatarEmotion` (la expresión de
 * la cara) a propósito: un rig de personaje real (Rive/Lottie) separa
 * "cara"/"cuerpo" en capas de animación independientes que se combinan,
 * no una sola variable que las mezcle todas (ver README, "Guía de
 * integración para I7"). Tres familias, ver `AvatarAnimationKind`:
 *
 * - **Loop** (`idle`/`listen`/`think`/`sleep`) -- se sostienen
 *   mientras la condición que las justifica siga siendo cierta. Nunca
 *   tienen una duración fija: duran lo que dura la evidencia real
 *   detrás (ver README, "¿Cuánto dura una sonrisa?").
 * - **Gesto** (`wave`/`jump`/`hug`/`nod`) -- un solo disparo, de
 *   duración corta y acotada (`AVATAR_GESTURE_DURATION_MS`), SOLO en
 *   la transición hacia una nueva `emotion` -- nunca en cada render
 *   mientras la emoción se sostiene (ese es exactamente el bug que
 *   `resolve-avatar-state.ts` evita con `previousEmotion`). Después de
 *   reproducirse, el personaje se asienta en el loop `idle` (la cara
 *   sigue mostrando la emoción real; el cuerpo vuelve a reposo).
 * - **Interacción en vivo** (`listen`/`think`/`sleep`) -- nunca
 *   derivadas de Presence/Experience/Narrative/Identity (esos son
 *   agregados de días/meses); vienen de `AvatarInteractionSignal`, el
 *   estado real de la sesión actual. Siempre interrumpen un gesto en
 *   curso, sin esperar a que termine (ver README, "¿Qué interrumpe
 *   qué?").
 *
 * `breathe`/`blink` del boceto original NO son valores propios aquí:
 * son micro-loops involuntarios que I7 dispara con su propio
 * temporizador MIENTRAS el personaje está en cualquier estado (igual
 * que un parpadeo real no depende de en qué esté pensando la persona)
 * -- nunca algo que este backend deba decidir explícitamente.
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

export const AVATAR_ANIMATION_KINDS = ["loop", "gesture"] as const;
export type AvatarAnimationKind = (typeof AVATAR_ANIMATION_KINDS)[number];

/** A qué familia pertenece cada `AvatarAnimation` -- para que I7 sepa, sin memorizar la lista, si algo debe sostenerse o reproducirse una vez y volver a `idle`. */
export const AVATAR_ANIMATION_KIND: Record<AvatarAnimation, AvatarAnimationKind> = {
  idle: "loop",
  listen: "loop",
  think: "loop",
  sleep: "loop",
  wave: "gesture",
  jump: "gesture",
  hug: "gesture",
  nod: "gesture",
};

/**
 * Duración nominal sugerida para cada gesto, en ms -- ADVISORIA, no una
 * medida real de ningún asset todavía (ninguno existe). Punto de
 * partida razonable para que I7 calibre contra el asset final, nunca
 * un valor que este backend haga cumplir -- el backend nunca corre un
 * temporizador propio (sería el mismo anti-patrón de loop de JS que
 * `features/orb/README.md` ya descarta por performance).
 */
export const AVATAR_GESTURE_DURATION_MS: Partial<Record<AvatarAnimation, number>> = {
  wave: 1200,
  jump: 1500,
  hug: 2000,
  nod: 800,
};
