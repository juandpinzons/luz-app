/**
 * De qué sistema salió un `ContinuityLoop` -- misión explícita: "may
 * originate from Memory/Calendar/Gmail/Goal/Project/Habit/Relationship/
 * Curiosity/Recommendation/Conversation/Life Event/Belief". Unión
 * cerrada a propósito (mismo criterio que `CalendarProviderKind`,
 * `EmailProviderKind`): cada consumidor puede hacer `switch` exhaustivo
 * sin adivinar valores posibles.
 *
 * No todos los orígenes tienen HOY una regla de apertura real (ver
 * `../detection/`) -- `habit` y `belief` viven en este vocabulario
 * porque la misión los nombra explícitamente y un `ContinuityLoop`
 * detectado manualmente/en una fase futura debe poder declararlos sin
 * una migración, pero ninguna regla determinista de esta fase los
 * produce todavía (documentado, no un olvido -- ver
 * `../detection/README` en el índice del módulo).
 */
export const LOOP_ORIGINS = [
  "memory",
  "calendar",
  "email",
  "goal",
  "project",
  "habit",
  "relationship",
  "curiosity",
  "recommendation",
  "conversation",
  "life_event",
  "belief",
] as const;

export type LoopOrigin = (typeof LOOP_ORIGINS)[number];
