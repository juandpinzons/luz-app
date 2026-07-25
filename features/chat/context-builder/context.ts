import type { ContextItem } from "../../../core/context-engine";
import type { RealityMemoryItem } from "../../../core/reality";
import type { RealitySnapshot } from "../../../core/reality";

/**
 * Un turno de la conversación ya persistida — forma neutral, no las
 * filas crudas de `conversation_messages`. `role` se limita a lo que
 * un LLM necesita ver; el dominio del chat no le importa a este
 * módulo.
 */
export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

/** Lo que una regla del Conversation Manual decide agregar, cuando aplica. */
export interface RuleDirective {
  ruleId: string;
  instruction: string;
}

/**
 * Clasificación determinista y mínima de qué tipo de respuesta busca
 * este momento — no un motor de intención, tres casos observables sin
 * IA. Existe para hacer explícito lo que hoy decidía implícitamente
 * la forma del prompt.
 */
export type ResponseIntent =
  | "first_contact"
  | "continue_conversation"
  | "reconnect_with_memory";

/**
 * El puente explícito entre Conversation, Memory (vía RealitySnapshot),
 * Reality Snapshot, Context Engine y Conversation Manual — Sprint B3,
 * Beta 1 Roadmap; Context Engine integrado Fase II. Reemplaza la
 * concatenación de texto que armaba `send-message.ts` directamente:
 * esto es una estructura inspeccionable, no un string.
 *
 * `memories` es una vista de conveniencia sobre
 * `realitySnapshot.memory.items` — nunca una segunda consulta
 * independiente. Vive aquí para que el código que solo necesita
 * memorias no tenga que conocer la forma completa del snapshot.
 *
 * `contextItems` es la salida de `ContextEngine.build()`
 * (`core/context-engine`) sobre `realitySnapshot`: lo que LUZ ya
 * decidió que merece atención en esta respuesta, ya cruzado entre
 * life/memory/insight/signal y ya recortado — las reglas del
 * Conversation Manual lo consumen en vez de decidir cada una por su
 * cuenta qué tanto de su propia fuente mostrar.
 */
export interface Context {
  conversation: ConversationTurn[];
  memories: RealityMemoryItem[];
  realitySnapshot: RealitySnapshot;
  contextItems: ContextItem[];
  conversationRules: RuleDirective[];
  responseIntent: ResponseIntent;
}
