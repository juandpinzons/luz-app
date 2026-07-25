import type { ContextItem } from "../../../../core/context-engine";
import type { ConversationTurn } from "../context";

/**
 * Lo mínimo que una regla necesita para decidir si aplica y qué decir.
 * `contextItems` reemplaza los arreglos separados `memories`/`insights`
 * que existían antes de Context Engine (Fase II): ya es la decisión de
 * qué merece atención, cruzada entre life/memory/insight/signal y
 * recortada por `ContextEngine.build()` — ninguna regla vuelve a
 * decidir eso por su cuenta, cada una solo decide cómo reaccionar a la
 * decisión ya tomada.
 */
export interface ConversationRuleInput {
  conversation: ConversationTurn[];
  contextItems: ContextItem[];
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
