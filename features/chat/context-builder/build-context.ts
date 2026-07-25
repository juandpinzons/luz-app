import { createContextEngine } from "../../../core/context-engine";
import type { Database } from "../../../core/db/client";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import { assembleRealitySnapshot } from "../services/assemble-reality-snapshot";
import { CONVERSATION_RULES } from "./conversation-rules";
import type {
  Context,
  ConversationTurn,
  ResponseIntent,
  RuleDirective,
} from "./context";

/**
 * Determinista, sin IA — tres casos observables directamente, no un
 * clasificador. `conversation` incluye el mensaje que se está
 * respondiendo — `length <= 1` significa que no existe ningún turno
 * previo, la primera vez que esta conversación tiene contenido.
 */
function determineResponseIntent(
  conversation: ConversationTurn[],
  memories: Context["memories"],
): ResponseIntent {
  if (conversation.length <= 1) {
    return "first_contact";
  }
  if (memories.length > 0) {
    return "reconnect_with_memory";
  }
  return "continue_conversation";
}

/**
 * El puente explícito entre Conversation, Memory, Reality Snapshot,
 * Context Engine y Conversation Manual (Sprint B3, Beta 1 Roadmap;
 * Context Engine integrado Fase II). Consume únicamente información ya
 * existente — ninguna fuente nueva: `assembleRealitySnapshot`
 * (Sprint B2) sigue siendo la única forma de obtener memorias
 * relevantes, nunca una segunda consulta paralela.
 *
 * `ContextEngine.build()` (ADR-0013, `core/context-engine`, sin
 * implementación real hasta ahora) es quien decide, cruzando las
 * cuatro fuentes de `RealitySnapshot`, qué merece atención en esta
 * respuesta puntual — antes de este cambio, cada regla decidía por su
 * cuenta si "aplicaba" y volcaba toda su fuente sin comparar contra
 * las demás, y `life` (goals/projects/habits activos) se calculaba en
 * `assembleRealitySnapshot` y nunca se usaba en ningún lado. Las
 * reglas del Conversation Manual ahora reciben esa decisión ya tomada
 * (`contextItems`), nunca las fuentes crudas por separado.
 *
 * Requiere `LifeGraphContext` real — igual que `assembleRealitySnapshot`
 * y `MemoryEngine.capture`. El llamador decide qué hacer si no existe
 * (mismo criterio ya establecido en `send-message.ts` desde Sprint B1:
 * degradar sin romper el chat, nunca exigirlo como requisito nuevo).
 */
export async function buildContext(
  db: Database,
  lifeGraphContext: LifeGraphContext,
  conversation: ConversationTurn[],
): Promise<Context> {
  // P0 (cierre del Alpha): el último turno es el mensaje que se está
  // respondiendo (docblock de arriba) — se pasa explícito para que
  // Reality Snapshot seleccione memorias relevantes para ESTE mensaje,
  // no las de mayor rank global (`selectContextualMemories`).
  const currentMessage = conversation.at(-1)?.content;
  const realitySnapshot = await assembleRealitySnapshot(db, lifeGraphContext, {
    currentMessage,
  });
  const memories = realitySnapshot.memory.items;

  const engineContext = await createContextEngine().build(
    realitySnapshot,
    lifeGraphContext,
  );
  const contextItems = engineContext.items;

  const conversationRules: RuleDirective[] = CONVERSATION_RULES.filter(
    (rule) => rule.applies({ conversation, contextItems }),
  ).map((rule) => ({
    ruleId: rule.id,
    instruction: rule.directive({ conversation, contextItems }),
  }));

  const responseIntent = determineResponseIntent(conversation, memories);

  return {
    conversation,
    memories,
    realitySnapshot,
    contextItems,
    conversationRules,
    responseIntent,
  };
}
