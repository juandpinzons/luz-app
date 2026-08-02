/**
 * Misma matemática que `consecutiveStreak`/`cooldownPenalty` en
 * `features/experience/services/apply-rotation.ts` (rotación de
 * tarjetas de Home) -- duplicada aquí a propósito, no importada: este
 * archivo vive en `core/`, ese vive en `features/`, y la dirección de
 * dependencia solo va en un sentido (mismo criterio que
 * `select-contextual-memories.ts` ya documenta para Memory/Knowledge
 * Engine). También duplicada, no compartida, con la copia hermana en
 * `core/context-engine/scoring/diversity-cooldown.ts` -- dos engines
 * distintos, cada uno con la suya, nunca una dependencia nueva entre
 * ellos por una utilidad de 15 líneas.
 */
/**
 * Cuántas veces seguidas puede una postura "de nota oportunista"
 * (Celebrate/Reflect/Confirm/Curiosity/Release) ganar el turno antes
 * de entrar en cooldown -- mismo valor y mismo criterio que
 * `MAX_CONSECUTIVE_DAYS` en `apply-rotation.ts`: puede repetir una vez,
 * nunca una segunda seguida.
 */
export const MAX_CONSECUTIVE_STRATEGY_REPEATS = 2;

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
 * Versión booleana de `cooldownPenalty` (`apply-rotation.ts`): una
 * regla de estrategia no puntúa, decide si aplica o no -- `appliesTo()`
 * necesita un sí/no, nunca un número que restar.
 */
export function isOnCooldown(streak: number, maxConsecutive: number): boolean {
  return streak >= maxConsecutive;
}

/**
 * Conveniencia para las cinco reglas "de nota oportunista"
 * (Celebrate/Reflect/Confirm/Curiosity/Release): ¿esta estrategia ya
 * ganó el turno las últimas `MAX_CONSECUTIVE_STRATEGY_REPEATS` veces
 * seguidas? Siempre coincidencia exacta -- una sola llamada por regla,
 * en vez de repetir `consecutiveStreak`+`isOnCooldown` cinco veces con
 * riesgo de que alguna copia se desincronice.
 */
export function isStrategyOnCooldown(
  strategyId: string,
  recentStrategyTypes: readonly string[],
): boolean {
  const streak = consecutiveStreak(strategyId, recentStrategyTypes, (entry, key) => entry === key);
  return isOnCooldown(streak, MAX_CONSECUTIVE_STRATEGY_REPEATS);
}
