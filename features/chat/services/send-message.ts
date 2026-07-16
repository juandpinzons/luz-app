import { and, asc, eq } from "drizzle-orm";
import { getAIProvider } from "../../../ai";
import type { AIMessage } from "../../../ai/provider";
import { db } from "../../../core/db/client";
import { conversationMessages, conversations } from "../../../core/db/schema";
import type { UserContext } from "../../../core/identity/user-context";
import { enqueueKnowledgeJob } from "../../../core/knowledge/jobs";

export interface SendMessageInput {
  context: UserContext;
  conversationId?: string;
  message: string;
}

export interface SendMessageResult {
  conversationId: string;
  reply: string;
}

async function getOrCreateConversation(
  context: UserContext,
  conversationId?: string,
): Promise<string> {
  const { userId } = context;

  if (conversationId) {
    const [existing] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      return existing.id;
    }
  }

  const [created] = await db
    .insert(conversations)
    .values({ userId })
    .returning({ id: conversations.id });

  if (!created) {
    throw new Error("No se pudo crear la conversación.");
  }

  return created.id;
}

/**
 * Servicio de dominio del chat: persiste la conversación, llama al
 * proveedor de IA activo y encola el análisis del Knowledge Engine.
 * `app/api/chat/route.ts` es un controlador delgado que solo llama a
 * esta función — toda la lógica de negocio vive aquí, en `features/`.
 *
 * Recibe un `UserContext`, nunca un id hardcodeado (Sprint 7): quién es
 * el usuario lo resuelve la Identity Layer (`auth/`) antes de llegar
 * aquí.
 */
export async function sendMessage(
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const { context } = input;

  const conversationId = await getOrCreateConversation(
    context,
    input.conversationId,
  );

  const [userMessage] = await db
    .insert(conversationMessages)
    .values({
      conversationId,
      userId: context.userId,
      role: "user",
      content: input.message,
    })
    .returning();

  if (!userMessage) {
    throw new Error("No se pudo guardar el mensaje del usuario.");
  }

  const history = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(asc(conversationMessages.createdAt));

  const aiMessages: AIMessage[] = history.map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));

  const reply = await getAIProvider().generateReply(aiMessages);

  await db.insert(conversationMessages).values({
    conversationId,
    userId: context.userId,
    role: "assistant",
    content: reply,
  });

  // El Knowledge Engine analiza el mensaje en segundo plano; esta llamada
  // no espera su procesamiento (decisión CTO #6: worker independiente).
  await enqueueKnowledgeJob(db, {
    userId: context.userId,
    sourceType: "conversation_message",
    sourceId: userMessage.id,
  });

  return { conversationId, reply };
}
