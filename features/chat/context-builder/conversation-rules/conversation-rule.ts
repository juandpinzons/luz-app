import type { ConversationTurn } from "../context";
import type { RealityInsightItem, RealityMemoryItem } from "../../../../core/reality";

/** Lo mínimo que una regla necesita para decidir si aplica y qué decir. */
export interface ConversationRuleInput {
  conversation: ConversationTurn[];
  memories: RealityMemoryItem[];
  /** Insights ya validados del Knowledge Engine (2026-07-25) — conocimiento a través del tiempo, distinto de `memories` ("qué pasó"). */
  insights: RealityInsightItem[];
}

/**
 * Una sola regla del Conversation Manual expresada como comportamiento
 * — nunca el manual completo convertido en un prompt (Sprint B3, Beta
 * 1 Roadmap). Pequeña, independiente, extensible: agregar una regla
 * nueva es un archivo nuevo que implementa esto, nunca una edición al
 * Context Builder ni a las demás reglas.
 */
export interface ConversationRule {
  readonly id: string;
  applies(input: ConversationRuleInput): boolean;
  directive(input: ConversationRuleInput): string;
}
