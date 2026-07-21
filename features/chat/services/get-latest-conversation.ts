import { desc, eq } from "drizzle-orm";
import { db } from "../../../core/db/client";
import { conversations } from "../../../core/db/schema";
import type { UserContext } from "../../../core/identity/user-context";
import { getConversationDetail } from "../../conversations/services/get-conversation-detail";

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
 *
 * Encuentra el id más reciente y delega en `getConversationDetail`
 * (Sprint Alpha-1b) para traer y filtrar los mensajes — antes esta
 * función tenía su propia copia casi idéntica de esa lógica; ahora hay
 * un solo lugar que sabe cómo traer el detalle de una conversación.
 * "Más reciente" sigue significando `conversations.createdAt` más alto
 * (comportamiento sin cambios) — no la última con actividad, que es
 * una decisión aparte, fuera de este sprint.
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

  const detail = await getConversationDetail(db, context, latest.id);

  if (!detail) {
    return null;
  }

  return { conversationId: detail.id, messages: detail.messages };
}
