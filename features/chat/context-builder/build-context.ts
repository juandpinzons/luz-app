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
 * El puente explícito entre Conversation, Memory, Reality Snapshot y
 * Conversation Manual (Sprint B3, Beta 1 Roadmap). Consume únicamente
 * información ya existente — ninguna fuente nueva: `assembleRealitySnapshot`
 * (Sprint B2) sigue siendo la única forma de obtener memorias
 * relevantes, nunca una segunda consulta paralela.
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
  const realitySnapshot = await assembleRealitySnapshot(db, lifeGraphContext);
  const memories = realitySnapshot.memory.items;

  const conversationRules: RuleDirective[] = CONVERSATION_RULES.filter(
    (rule) => rule.applies({ conversation, memories }),
  ).map((rule) => ({
    ruleId: rule.id,
    instruction: rule.directive({ conversation, memories }),
  }));

  const responseIntent = determineResponseIntent(conversation, memories);

  return {
    conversation,
    memories,
    realitySnapshot,
    conversationRules,
    responseIntent,
  };
}
