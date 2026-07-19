import { asc, count, desc, eq, max } from "drizzle-orm";
import type { Database } from "../../../core/db/client";
import { conversationMessages, conversations } from "../../../core/db/schema";
import type { UserContext } from "../../../core/identity/user-context";

const PREVIEW_MAX_LENGTH = 80;

export interface ConversationListItem {
  id: string;
  createdAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  previewText: string;
}

function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim();
  return trimmed.length <= maxLength
    ? trimmed
    : `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

/**
 * Historial de conversaciones (Sprint Alpha-1b) — solo las del usuario
 * autenticado, ordenadas por última actividad real (el mensaje más
 * reciente, no `conversations.updatedAt`: esa columna nunca se toca
 * después de crear la fila, `send-message.ts` no la actualiza).
 *
 * Dos consultas, ambas acotadas por índice existente
 * (`conversation_messages_user_id_idx`,
 * `conversation_messages_conversation_id_idx`): una agregada para
 * conteo/última actividad, y un `selectDistinctOn` para el primer
 * mensaje de cada conversación (el preview) — nunca traer el historial
 * completo solo para mostrar una lista.
 *
 * Excluye conversaciones sin ningún mensaje: no hay nada real que
 * previsualizar ni que abrir en el detalle, y `sendMessage` siempre
 * crea la conversación junto con su primer mensaje, así que en la
 * práctica no debería ocurrir — se filtra de todas formas en vez de
 * mostrar una tarjeta vacía.
 */
export async function listConversations(
  db: Database,
  context: UserContext,
): Promise<ConversationListItem[]> {
  const stats = await db
    .select({
      id: conversations.id,
      createdAt: conversations.createdAt,
      lastMessageAt: max(conversationMessages.createdAt),
      messageCount: count(conversationMessages.id),
    })
    .from(conversations)
    .innerJoin(
      conversationMessages,
      eq(conversationMessages.conversationId, conversations.id),
    )
    .where(eq(conversations.userId, context.userId))
    .groupBy(conversations.id)
    .orderBy(desc(max(conversationMessages.createdAt)));

  const firstMessages = await db
    .selectDistinctOn([conversationMessages.conversationId], {
      conversationId: conversationMessages.conversationId,
      content: conversationMessages.content,
    })
    .from(conversationMessages)
    .where(eq(conversationMessages.userId, context.userId))
    .orderBy(
      conversationMessages.conversationId,
      asc(conversationMessages.createdAt),
    );

  const previewByConversationId = new Map(
    firstMessages.map((message) => [message.conversationId, message.content]),
  );

  return stats.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    // `innerJoin` + `groupBy` garantiza al menos un mensaje por fila, así que
    // el máximo nunca es null aquí — el tipo de `max()` sigue siendo nullable.
    lastMessageAt: row.lastMessageAt ?? row.createdAt,
    messageCount: row.messageCount,
    previewText: truncate(
      previewByConversationId.get(row.id) ?? "",
      PREVIEW_MAX_LENGTH,
    ),
  }));
}
