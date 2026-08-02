/**
 * Misma matemática que `consecutiveStreak`/`cooldownPenalty` en
 * `features/experience/services/apply-rotation.ts` (rotación de
 * tarjetas de Home) -- duplicada aquí a propósito, no importada: este
 * archivo vive en `core/`, ese vive en `features/`, y la dirección de
 * dependencia solo va en un sentido (mismo criterio que
 * `select-contextual-memories.ts` ya documenta para Memory/Knowledge
 * Engine). También duplicada, no compartida, con la copia hermana en
 * `core/conversation-strategy-engine/rules/diversity-cooldown.ts` --
 * dos engines distintos, cada uno con la suya, nunca una dependencia
 * nueva entre ellos por una utilidad de 15 líneas.
 */
export function consecutiveStreak<T>(
  key: string,
  recentEntries: readonly T[],
  matches: (entry: T, key: string) => boolean,
): number {
  let streak = 0;
  for (const entry of recentEntries) {
    if (!matches(entry, key)) break;
    streak += 1;
  }
  return streak;
}

/**
 * Igual que `apply-rotation.ts`: por debajo de `maxConsecutive`, cero
 * penalización -- las candidatas compiten únicamente por relevancia
 * real, nunca por antigüedad.
 */
export function cooldownPenalty(
  streak: number,
  maxConsecutive: number,
  penaltyValue: number,
): number {
  return streak >= maxConsecutive ? penaltyValue : 0;
}
