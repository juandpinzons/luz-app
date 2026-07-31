import type { ExperienceCard } from "../domain/experience-state";

export interface RotationResult {
  primary: ExperienceCard | null;
  secondary: ExperienceCard[];
  postponed: ExperienceCard[];
  isNewPrimary: boolean;
}

/**
 * Cuántos días seguidos puede una misma tarjeta ganar `primary` antes
 * de que la rotación la fuerce a un descanso -- "la misma tarjeta
 * primaria no debe quedarse visible indefinidamente" (Fase 3), pero
 * sin inventar variedad falsa: por debajo de este umbral, las
 * candidatas compiten únicamente por importancia real, nunca por
 * antigüedad. 2 significa "puede repetir una vez, nunca una segunda".
 */
const MAX_CONSECUTIVE_DAYS = 2;

/**
 * Suficientemente grande para garantizar que ninguna candidata en
 * cooldown le gane a una candidata real en escala 0-4 -- nunca un
 * empate accidental entre "penalizada" y "importante de verdad".
 */
const COOLDOWN_PENALTY = 100;

const MAX_SECONDARY_CARDS = 3;
const MAX_POSTPONED_CARDS = 3;

/**
 * Cuántas entradas, empezando por la más reciente, coinciden
 * exactamente con `key` antes de la primera que no coincide --
 * "cuántos días seguidos HASTA HOY ya fue `primary`". `recentPrimaryKeys[0]`
 * es la más reciente; una racha rota (`[X, Y, X]`) para `X` da 0, no 2 --
 * la rotación solo le importa la racha *actual*, no cuántas veces en total.
 */
function consecutiveStreak(key: string, recentPrimaryKeys: readonly string[]): number {
  let streak = 0;
  for (const pastKey of recentPrimaryKeys) {
    if (pastKey !== key) break;
    streak += 1;
  }
  return streak;
}

function cooldownPenalty(streak: number): number {
  return streak >= MAX_CONSECUTIVE_DAYS ? COOLDOWN_PENALTY : 0;
}

/**
 * Determinístico de punta a punta: mismas candidatas + mismo historial
 * siempre producen el mismo resultado. Sin aleatoriedad, sin IA, sin
 * "refrescar por refrescar" -- si de verdad solo hay una candidata
 * real, se muestra otra vez (inventar una alternativa sería la "novedad
 * fabricada" que esta misión prohíbe explícitamente).
 */
export function applyRotation(
  candidates: readonly ExperienceCard[],
  recentPrimaryKeys: readonly string[],
): RotationResult {
  if (candidates.length === 0) {
    return { primary: null, secondary: [], postponed: [], isNewPrimary: false };
  }

  const withPenalty = candidates.map((card) => {
    const streak = consecutiveStreak(card.key, recentPrimaryKeys);
    return { card, penalty: cooldownPenalty(streak) };
  });

  const byEffectiveScore = [...withPenalty].sort((a, b) => {
    const effectiveA = a.card.importance - a.penalty;
    const effectiveB = b.card.importance - b.penalty;
    if (effectiveB !== effectiveA) return effectiveB - effectiveA;
    // Empate en score efectivo: desempata por `key` para que el resultado sea 100% determinístico entre runs, nunca dependiente del orden de inserción.
    return a.card.key.localeCompare(b.card.key);
  });

  const [winner, ...rest] = byEffectiveScore;
  const primary = winner.card;
  const isNewPrimary = recentPrimaryKeys[0] !== primary.key;

  const postponed = rest
    .filter((entry) => entry.penalty > 0)
    .sort((a, b) => b.card.importance - a.card.importance)
    .slice(0, MAX_POSTPONED_CARDS)
    .map((entry) => entry.card);

  const postponedKeys = new Set(postponed.map((card) => card.key));
  const secondary = rest
    .filter((entry) => !postponedKeys.has(entry.card.key))
    .sort((a, b) => b.card.importance - a.card.importance)
    .slice(0, MAX_SECONDARY_CARDS)
    .map((entry) => entry.card);

  return { primary, secondary, postponed, isNewPrimary };
}
