/**
 * Modos relacionales, no posturas de contenido -- `core/
 * conversation-strategy-engine` ya decide QUÉ debe lograr la
 * respuesta (10 posturas finas: Listen/Clarify/Encourage/Challenge/
 * Celebrate/Remind/Plan/FollowUp/Curiosity/Reflect). Presence colapsa
 * esas 10 a un vocabulario más pequeño y relacional -- CÓMO está
 * presente LUZ ahora mismo -- tomado directo de
 * `docs/vision/PRESENCE_PRINCIPLES.md`, nunca inventado aparte.
 * `"silence"` es un valor real, no decorativo: ver
 * `DefaultPresenceEngine` para las condiciones exactas bajo las que se
 * produce.
 */
export const PRESENCE_MODES = [
  "accompany",
  "listen",
  "celebrate",
  "challenge",
  "silence",
] as const;

export type PresenceMode = (typeof PRESENCE_MODES)[number];
