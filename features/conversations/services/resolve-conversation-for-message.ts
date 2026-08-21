import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../../core/db/client";
import { conversationMessages } from "../../../core/db/schema";

/**
 * De `Memory.sourceId` (= `conversation_messages.id` cuando
 * `memory.source === "conversation"`) a su `conversationId` real, para
 * que `/memories` pueda enlazar a `/conversations/[id]` -- una sola
 * consulta por lote (mismo patrón que `loadConnectionsByMemoryId` en
 * `search-memories.ts`), nunca una consulta por tarjeta.
 *
 * Escopado por `userId` (columna directa en `conversation_messages`,
 * sin unir contra `conversations`) -- un `sourceId` que no le pertenece
 * a esta persona simplemente no aparece en el mapa devuelto, en vez de
 * filtrarse después.
 */
export async function resolveConversationIdsForMessages(
  db: Database,
  userId: string,
  messageIds: string[],
): Promise<Map<string, string>> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({ id: conversationMessages.id, conversationId: conversationMessages.conversationId })
    .from(conversationMessages)
    .where(and(inArray(conversationMessages.id, messageIds), eq(conversationMessages.userId, userId)));

  return new Map(rows.map((row) => [row.id, row.conversationId]));
}
