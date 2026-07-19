import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../../../core/db/client";
import { conversationMessages, conversations } from "../../../core/db/schema";
import type { UserContext } from "../../../core/identity/user-context";

export interface ConversationDetailMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationDetail {
  id: string;
  createdAt: Date;
  messages: ConversationDetailMessage[];
}

/**
 * Detalle de una conversación (Sprint Alpha-1b) — únicamente lectura.
 * `null` tanto si la conversación no existe como si existe pero no es
 * del usuario autenticado: mismo resultado en ambos casos (igual que
 * `getLatestConversation`), para que la ruta responda 404 sin revelar
 * si la conversación de otra persona existe.
 */
export async function getConversationDetail(
  db: Database,
  context: UserContext,
  conversationId: string,
): Promise<ConversationDetail | null> {
  const [conversation] = await db
    .select({ id: conversations.id, createdAt: conversations.createdAt })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, context.userId),
      ),
    )
    .limit(1);

  if (!conversation) {
    return null;
  }

  const history = await db
    .select({
      role: conversationMessages.role,
      content: conversationMessages.content,
    })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversation.id))
    .orderBy(asc(conversationMessages.createdAt));

  const messages: ConversationDetailMessage[] = history.filter(
    (entry): entry is typeof entry & { role: "user" | "assistant" } =>
      entry.role === "user" || entry.role === "assistant",
  );

  return { id: conversation.id, createdAt: conversation.createdAt, messages };
}
