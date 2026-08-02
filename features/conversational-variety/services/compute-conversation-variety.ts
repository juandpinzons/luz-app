import { LIFE_DOMAIN_TYPES } from "../../../core/life/value-objects/life-domain-type";
import type { ConversationCategory } from "../../../core/db/schema/conversations";
import type { ConversationVarietyEntry } from "../domain/conversation-variety-entry";
import type {
  ConversationVarietySnapshot,
  DomainFrequency,
} from "../domain/conversation-variety-snapshot";

/** 8 `LifeDomainType` + `"general"` -- el universo completo de `ConversationCategory`, calculado (nunca `9` a mano) para no desincronizarse si algún día se agrega un dominio. */
const TOTAL_CONVERSATION_CATEGORIES = LIFE_DOMAIN_TYPES.length + 1;

/**
 * Bajo esta cantidad de conversaciones reales en la ventana, un share
 * alto puede ser pura coincidencia orgánica (2 de 3 conversaciones
 * sobre lo mismo, en una cuenta nueva, no es obsesión) -- el
 * disparador por racha (`MONOTONY_STREAK_THRESHOLD`) sigue aplicando
 * sin importar el tamaño de la ventana.
 */
const MIN_WINDOW_FOR_SHARE_CHECK = 6;
/** Un dominio que ocupa la mitad o más de la ventana ya domina de verdad. */
const MONOTONY_SHARE_THRESHOLD = 0.5;
/** Cuatro conversaciones SEGUIDAS sobre lo mismo -- sin importar el tamaño de la ventana, cuatro en fila es una racha real. */
const MONOTONY_STREAK_THRESHOLD = 4;

/**
 * Primera iteración, no un techo -- mismo criterio que declara
 * `select-contextual-memories.ts` ("pesos ajustables, nunca una
 * fórmula final"): estos tres números son un punto de partida
 * razonable sin datos reales de uso todavía, pensados para
 * recalibrarse con evidencia real de cuántas conversaciones por
 * semana genera una persona real.
 */

/** Mismo algoritmo que `consecutiveStreak` en `apply-rotation.ts` (`features/experience/services/`) -- duplicado aquí a propósito, no importado: ni `core/context-engine/scoring/diversity-cooldown.ts` ni su hermana en `core/conversation-strategy-engine` se re-exportan desde el `index.ts` público de su módulo, y no existe en todo el repo un solo precedente de importar más allá del barrel público de otro módulo. Misma utilidad de 15 líneas, tercera copia, mismo criterio que ya justifica las dos anteriores: demasiado pequeña para justificar acoplar un módulo a otro por ella. */
function consecutiveStreak<T>(
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

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Determinista, sin IA, sin IO -- recibe `entries` ya resueltas
 * (`assembleConversationalVariety`), más reciente primero (mismo
 * orden que `consecutiveStreak` ya asume en el resto del repo). No
 * decide su propio tamaño de ventana -- solo procesa lo que recibe,
 * mismo criterio que `buildIdentitySnapshot` (el ensamblador decide
 * cuánta historia trae, la función pura solo la interpreta).
 */
export function computeConversationVariety(
  entries: readonly ConversationVarietyEntry[],
  now: Date = new Date(),
): ConversationVarietySnapshot {
  const windowSize = entries.length;

  if (windowSize === 0) {
    return {
      asOf: now,
      windowSize: 0,
      diversityScore: 0,
      frequencies: [],
      dominantDomain: null,
      dominantDomainStreak: 0,
      isMonotonous: false,
      fatiguedDomain: null,
    };
  }

  const countByDomain = new Map<ConversationCategory, number>();
  const mostRecentByDomain = new Map<ConversationCategory, Date>();
  for (const entry of entries) {
    countByDomain.set(entry.category, (countByDomain.get(entry.category) ?? 0) + 1);
    const seen = mostRecentByDomain.get(entry.category);
    if (!seen || entry.occurredAt.getTime() > seen.getTime()) {
      mostRecentByDomain.set(entry.category, entry.occurredAt);
    }
  }

  const frequencies: DomainFrequency[] = [...countByDomain.entries()]
    .map(([domain, count]) => ({
      domain,
      count,
      shareOfWindow: count / windowSize,
      daysSinceLastConversation: daysBetween(mostRecentByDomain.get(domain) ?? now, now),
    }))
    .sort((a, b) => {
      const shareDelta = b.shareOfWindow - a.shareOfWindow;
      // Empate desempatado por nombre de categoría -- 100% determinístico entre corridas.
      return shareDelta !== 0 ? shareDelta : a.domain.localeCompare(b.domain);
    });

  const dominantDomain = frequencies[0] ?? null;
  const dominantDomainStreak = dominantDomain
    ? consecutiveStreak(dominantDomain.domain, entries, (entry, key) => entry.category === key)
    : 0;

  const isMonotonous = Boolean(
    dominantDomain &&
      ((windowSize >= MIN_WINDOW_FOR_SHARE_CHECK &&
        dominantDomain.shareOfWindow >= MONOTONY_SHARE_THRESHOLD) ||
        dominantDomainStreak >= MONOTONY_STREAK_THRESHOLD),
  );

  const diversityScore = frequencies.length / TOTAL_CONVERSATION_CATEGORIES;

  return {
    asOf: now,
    windowSize,
    diversityScore,
    frequencies,
    dominantDomain,
    dominantDomainStreak,
    isMonotonous,
    fatiguedDomain: isMonotonous ? dominantDomain : null,
  };
}
