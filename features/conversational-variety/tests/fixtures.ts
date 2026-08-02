import type { ConversationCategory } from "../../../core/db/schema/conversations";
import type { ConversationVarietyEntry } from "../domain/conversation-variety-entry";

/** Reloj fijo -- todo escenario ancla `now` aquí para que el resultado sea reproducible byte a byte entre corridas. */
export const NOW = new Date("2026-08-01T12:00:00.000Z");

export function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

/**
 * Construye `ConversationVarietyEntry[]` a partir de una lista de
 * categorías, más reciente primero (mismo orden que
 * `assembleConversationalVariety` entrega) -- `daysApart` separa cada
 * entrada sucesiva, así que el índice 0 es la más reciente (`daysAgo(0)`
 * si `startDaysAgo` no se pasa).
 */
export function makeEntries(
  categories: readonly ConversationCategory[],
  options: { startDaysAgo?: number; daysApart?: number } = {},
): ConversationVarietyEntry[] {
  const start = options.startDaysAgo ?? 0;
  const step = options.daysApart ?? 2;
  return categories.map((category, index) => ({
    category,
    occurredAt: daysAgo(start + index * step),
  }));
}
