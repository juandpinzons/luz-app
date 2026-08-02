import { and, count, eq, gte, max } from "drizzle-orm";
import type { Database } from "../../../core/db/client";
import { conversationMessages, memories } from "../../../core/db/schema";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import type { RealitySnapshot } from "../../../core/reality";
import {
  deriveConversationChapter,
  type ConversationChapter,
} from "./derive-conversation-chapter";
import { detectChatRealityChange, type ChatRealityChange } from "./detect-chat-reality-change";

/**
 * A partir de cuántas horas sin hablar se considera un vacío real --
 * por debajo de esto, reabrir la app dos veces en la misma tarde no
 * debería sentirse como "mira todo lo que cambió". Punto de partida
 * razonable, explícitamente ajustable (mismo espíritu que el resto de
 * las constantes de este redesign).
 */
const MEANINGFUL_GAP_HOURS = 8;

export interface ReconnectionContext {
  chapter: ConversationChapter | null;
  changes: ChatRealityChange[];
}

/**
 * "Qué cambió" + "qué capítulo vive" juntos (redesign del pipeline
 * conversacional, Beta) -- el único orquestador impuro de este par de
 * gaps, mismo criterio del resto del Context Builder: la regla que los
 * consume (`FrameReconnectionRule`) nunca hace su propia consulta.
 * `null` si no aplica -- no es el primer mensaje de una conversación
 * nueva, o LUZ nunca respondió antes, o el vacío no es real todavía.
 */
export async function assembleReconnectionContext(
  db: Database,
  context: LifeGraphContext,
  userId: string,
  isFirstContact: boolean,
  realitySnapshot: RealitySnapshot,
): Promise<ReconnectionContext | null> {
  if (!isFirstContact) {
    return null;
  }

  const [row] = await db
    .select({ lastAssistantMessageAt: max(conversationMessages.createdAt) })
    .from(conversationMessages)
    .where(
      and(eq(conversationMessages.userId, userId), eq(conversationMessages.role, "assistant")),
    );

  const lastAssistantMessageAt = row?.lastAssistantMessageAt ?? null;
  if (!lastAssistantMessageAt) {
    // Nunca respondió antes -- primer contacto real, no una
    // reapertura. `ReopenStrategyRule`/`ListenStrategyRule` ya cubren
    // ese momento; esta regla no tiene nada real que decir todavía.
    return null;
  }

  const gapHours = (Date.now() - lastAssistantMessageAt.getTime()) / (1000 * 60 * 60);
  if (gapHours < MEANINGFUL_GAP_HOURS) {
    return null;
  }

  const [memoriesRow] = await db
    .select({ value: count() })
    .from(memories)
    .where(
      and(eq(memories.lifeGraphId, context.lifeGraphId), gte(memories.createdAt, lastAssistantMessageAt)),
    );

  const chapter = deriveConversationChapter(realitySnapshot);
  const changes = detectChatRealityChange(memoriesRow?.value ?? 0);

  if (!chapter && changes.length === 0) {
    return null;
  }

  return { chapter, changes };
}
