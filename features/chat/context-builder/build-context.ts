import { createConversationStrategyEngine } from "../../../core/conversation-strategy-engine";
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
 * clasificador. `isFirstContact` (`conversation.length <= 1`, sin
 * ningún turno previo) se calcula una sola vez en `buildContext` y se
 * pasa aquí — el mismo criterio que también necesita
 * `ConversationStrategyEngine.select()`, nunca recalculado dos veces.
 */
function determineResponseIntent(
  isFirstContact: boolean,
  memories: Context["memories"],
): ResponseIntent {
  if (isFirstContact) {
    return "first_contact";
  }
  if (memories.length > 0) {
    return "reconnect_with_memory";
  }
  return "continue_conversation";
}

/**
 * El puente explícito entre Conversation, Memory, Reality Snapshot,
 * Context Engine, Conversation Strategy Engine y Conversation Manual
 * (Sprint B3, Beta 1 Roadmap; Context Engine y Conversation Strategy
 * Engine integrados en Fase II). Consume únicamente información ya
 * existente — ninguna fuente nueva: `assembleRealitySnapshot`
 * (Sprint B2) sigue siendo la única forma de obtener memorias
 * relevantes, nunca una segunda consulta paralela.
 *
 * `ContextEngine.build()` (ADR-0013, `core/context-engine`) decide,
 * cruzando las cuatro fuentes de `RealitySnapshot`, qué merece
 * atención en esta respuesta puntual. `ConversationStrategyEngine.select()`
 * (`core/conversation-strategy-engine`) va un paso más allá: a partir
 * de esa misma decisión, decide CÓMO conversar — una de ocho posturas
 * deterministas (Listen/Clarify/Encourage/Challenge/Celebrate/Remind/
 * Plan/FollowUp), nunca elegida por el modelo. Las reglas del
 * Conversation Manual y el Prompt Builder reciben ambas decisiones ya
 * tomadas (`contextItems`, `conversationStrategy`), nunca las fuentes
 * crudas por separado.
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
  const isFirstContact = conversation.length <= 1;
  const realitySnapshot = await assembleRealitySnapshot(db, lifeGraphContext, {
    currentMessage,
  });
  const memories = realitySnapshot.memory.items;

  const engineContext = await createContextEngine().build(
    realitySnapshot,
    lifeGraphContext,
  );
  const contextItems = engineContext.items;

  // Conversation Strategy Engine (Fase II): inmediatamente después de
  // Context Engine, antes del Prompt Builder (`renderContextToMessages`,
  // `render-context.ts`) — nunca vuelve a consultar Memory Engine,
  // Knowledge Engine ni Life State por su cuenta, solo lo que
  // `realitySnapshot` y `contextItems` ya trajeron.
  const conversationStrategy = createConversationStrategyEngine().select({
    realitySnapshot,
    contextItems,
    isFirstContact,
  });

  const conversationRules: RuleDirective[] = CONVERSATION_RULES.filter(
    (rule) => rule.applies({ conversation, contextItems }),
  ).map((rule) => ({
    ruleId: rule.id,
    instruction: rule.directive({ conversation, contextItems }),
  }));

  const responseIntent = determineResponseIntent(isFirstContact, memories);

  return {
    conversation,
    memories,
    realitySnapshot,
    contextItems,
    conversationStrategy,
    conversationRules,
    responseIntent,
  };
}
