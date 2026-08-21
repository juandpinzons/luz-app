import type { ConversationStrategyDirective } from "../../../core/conversation-strategy-engine";
import type { ContextItem } from "../../../core/context-engine";
import type { LifeDomainType } from "../../../core/life/value-objects/life-domain-type";
import type { PresenceStance } from "../../../core/presence-engine";
import type { RealityMemoryItem } from "../../../core/reality";
import type { RealitySnapshot } from "../../../core/reality";
import type { VoiceSignature } from "../../../core/voice-engine";

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
 *
 * `conversationStrategy` es la salida de
 * `ConversationStrategyEngine.select()` (`core/conversation-strategy-engine`,
 * Fase II) sobre ese mismo `contextItems` — no qué mostrar, sino cómo
 * conversar: una de diez posturas (Listen/Clarify/Encourage/Challenge/
 * Celebrate/Remind/Plan/FollowUp/Curiosity/Reflect), siempre exactamente
 * una, nunca ausente (`ListenStrategyRule` es un catch-all incondicional).
 * `Reflect` es donde Reasoning (`RealitySnapshot.reasoning`,
 * `core/knowledge-engine/reasoning`) entra a esta cadena: no como un
 * campo propio de `Context`, sino ya incorporado al `reason`/
 * `primaryObjective`/`avoid` de la estrategia cuando una conclusión
 * validada gana la priorización — un único lugar decide si la
 * evidencia acumulada importa más que el resto de las señales de este
 * turno, nunca dos.
 *
 * `presence` (`core/presence-engine`, Fase II) decide, a partir de
 * `conversationStrategy`, CÓMO está presente LUZ en este momento
 * (acompañar/escuchar/celebrar/desafiar/silencio) — nunca qué decir.
 * `voice` (`core/voice-engine`) traduce esa postura a CÓMO suena
 * (registro, calidez, largo máximo, qué evitar) — tampoco genera texto.
 * Ninguna de las dos sabe que existe un LLM del otro lado; el Prompt
 * Builder (`render-context.ts`) es el único que lo sabe y las traduce a
 * mensajes — el modelo recibe la intención, la presencia y el estilo ya
 * decididos, nunca los decide él.
 */
export interface Context {
  conversation: ConversationTurn[];
  memories: RealityMemoryItem[];
  realitySnapshot: RealitySnapshot;
  contextItems: ContextItem[];
  conversationStrategy: ConversationStrategyDirective;
  presence: PresenceStance;
  voice: VoiceSignature;
  conversationRules: RuleDirective[];
  responseIntent: ResponseIntent;
  /** El dominio fatigado que ya alimentó a `conversationStrategy` (Conversational Variety V1) -- expuesto aquí para que `send-message.ts` pueda re-derivar, del mismo snapshot inmutable, si la `CuriosityQuestion` pendiente fue de verdad la que ganó este turno (mismo criterio que ya usa para `reopen`/`acknowledge_closure`, ver ese docblock). */
  fatiguedDomain: LifeDomainType | null;
}
