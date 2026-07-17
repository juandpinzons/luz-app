import { desc, eq } from "drizzle-orm";
import { asc } from "drizzle-orm";
import { db } from "../../../core/db/client";
import { conversationMessages, conversations } from "../../../core/db/schema";
import type { UserContext } from "../../../core/identity/user-context";

export interface LatestConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LatestConversation {
  conversationId: string;
  messages: LatestConversationMessage[];
}

/**
 * La conversación más reciente del usuario, con su historial completo —
 * para que /chat pueda recuperar el hilo al volver a abrirse, en vez de
 * empezar vacío cada vez (el mensaje ya vivía en Postgres desde
 * Sprint 7; solo nadie lo volvía a pedir). `null` si el usuario nunca
 * ha conversado con LUZ.
 */
export async function getLatestConversation(
  context: UserContext,
): Promise<LatestConversation | null> {
  const [latest] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.userId, context.userId))
    .orderBy(desc(conversations.createdAt))
    .limit(1);

  if (!latest) {
    return null;
  }

  const history = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, latest.id))
    .orderBy(asc(conversationMessages.createdAt));

  const messages: LatestConversationMessage[] = history
    .filter(
      (entry): entry is typeof entry & { role: "user" | "assistant" } =>
        entry.role === "user" || entry.role === "assistant",
    )
    .map((entry) => ({ role: entry.role, content: entry.content }));

  return { conversationId: latest.id, messages };
}
