import type { ContextItem } from "../../context-engine";
import type { RealityInsightItem, RealityMemoryItem } from "../../reality";
import type { ConversationStrategyRuleInput } from "./conversation-strategy-rule";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Helpers internos, compartidos solo entre las reglas de este engine
 * — no forman parte del barrel público (`index.ts`), mismo criterio
 * que `MIN_SCORE_WITH_UNDERSTANDING_SIGNAL`
 * (`core/memory-engine/ranking`): implementación, no contrato.
 */

/**
 * Insights validados que además hicieron el corte de Context Engine —
 * nunca todo `realitySnapshot.insights.items`, solo lo que ya se
 * decidió que merece atención en esta respuesta. Cruza por `id`
 * porque `ContextItem` no repite el `type` del insight (frontera
 * anti-corrupción de `core/reality`, ver `insight-context-snapshot.ts`)
 * — este cruce vive aquí, no una segunda vez en cada regla.
 */
export function prioritizedInsights(
  input: ConversationStrategyRuleInput,
): RealityInsightItem[] {
  const ids = new Set(
    input.contextItems
      .filter((item) => item.source === "insight")
      .map((item) => item.sourceId),
  );
  return input.realitySnapshot.insights.items.filter((insight) => ids.has(insight.id));
}

/** Mismo criterio que `prioritizedInsights`, para memorias — necesario para leer `occurredAt`, que `ContextItem` no trae. */
export function prioritizedMemories(
  input: ConversationStrategyRuleInput,
): RealityMemoryItem[] {
  const ids = new Set(
    input.contextItems
      .filter((item) => item.source === "memory")
      .map((item) => item.sourceId),
  );
  return input.realitySnapshot.memory.items.filter((memory) => ids.has(memory.id));
}

/**
 * `ContextItem` ya trae `label`/`dueDate` para `life` directamente
 * (`DeterministicContextFilterStrategy`) — a diferencia de insight y
 * memory, nunca hace falta cruzar de vuelta contra `realitySnapshot`.
 */
export function prioritizedLifeItems(input: ConversationStrategyRuleInput): ContextItem[] {
  return input.contextItems.filter((item) => item.source === "life");
}

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / DAY_MS;
}

export function hoursBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / HOUR_MS;
}

/** Positivo si `date` está en el futuro respecto a ahora, negativo si ya pasó. */
export function daysUntil(date: Date, now: Date): number {
  return (date.getTime() - now.getTime()) / DAY_MS;
}
