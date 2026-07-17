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
 * Reality Snapshot y Conversation Manual — Sprint B3, Beta 1 Roadmap.
 * Reemplaza la concatenación de texto que armaba `send-message.ts`
 * directamente: esto es una estructura inspeccionable, no un string.
 *
 * `memories` es una vista de conveniencia sobre
 * `realitySnapshot.memory.items` — nunca una segunda consulta
 * independiente. Vive aquí para que el código que solo necesita
 * memorias no tenga que conocer la forma completa del snapshot.
 */
export interface Context {
  conversation: ConversationTurn[];
  memories: RealityMemoryItem[];
  realitySnapshot: RealitySnapshot;
  conversationRules: RuleDirective[];
  responseIntent: ResponseIntent;
}
