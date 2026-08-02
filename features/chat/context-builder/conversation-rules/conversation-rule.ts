import type { ContextItem } from "../../../../core/context-engine";
import type { ConversationTurn } from "../context";
import type { ReconnectionContext } from "../../services/assemble-reconnection-context";
import type { ConversationVarietyRuleSignal } from "../../../conversational-variety";

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
  /**
   * "Qué cambió" + "qué capítulo vive" (redesign del pipeline
   * conversacional, Beta) -- `null` salvo que de verdad haya un vacío
   * real desde la última vez que se habló, ya resuelto por la capa de
   * aplicación (`assembleReconnectionContext`). Aditivo: las reglas que
   * ya existían antes de esto lo ignoran y no cambian de comportamiento.
   */
  reconnectionContext: ReconnectionContext | null;
  /**
   * Conversational Variety V1 -- ¿ha dominado un solo dominio de vida
   * las conversaciones recientes? (`features/conversational-variety`,
   * ensamblado por `features/chat/services/assemble-conversation-variety-context.ts`).
   * Aditivo, mismo criterio que `reconnectionContext`: las reglas que
   * ya existían antes de esto lo ignoran y no cambian de
   * comportamiento. No reemplaza Narrative ni Identity Evolution --
   * solo evita monotonía.
   */
  variety: ConversationVarietyRuleSignal | null;
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
