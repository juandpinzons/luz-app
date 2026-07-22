import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAIProvider } from "../../../ai";
import type { Database } from "../../../core/db/client";
import { conversations } from "../../../core/db/schema";

const titleSchema = z.object({
  title: z.string().min(1).max(60),
});

export interface GenerateConversationTitleInput {
  conversationId: string;
  userMessage: string;
  assistantReply: string;
}

/**
 * Se llama una sola vez por conversación, en su primer intercambio
 * (ver `isNewConversation` en `send-message.ts`) — nunca en cada
 * mensaje, eso sería ruido de IA sin ningún propósito real ("presencia,
 * sin presión" también aplica a lo que LUZ hace de más en segundo
 * plano). Nunca puede romper la conversación: cualquier fallo (del
 * proveedor de IA o de la escritura en base de datos) se traga acá, y
 * `conversations.title` simplemente sigue en `null` — `previewText`
 * (`list-conversations.ts`) sigue funcionando exactamente igual que
 * antes de que existiera esta función.
 */
export async function generateConversationTitle(
  db: Database,
  input: GenerateConversationTitleInput,
): Promise<void> {
  try {
    const aiProvider = getAIProvider();
    const { title } = await aiProvider.generateStructured(
      [
        {
          role: "system",
          content:
            "Devuelve un título corto (máximo 6 palabras, sin comillas ni punto final) que resuma de qué trata esta conversación.",
        },
        { role: "user", content: input.userMessage },
        { role: "assistant", content: input.assistantReply },
      ],
      { name: "conversation_title", schema: titleSchema },
    );

    await db
      .update(conversations)
      .set({ title: title.trim() })
      .where(eq(conversations.id, input.conversationId));
  } catch (error) {
    console.error(
      "[generate-title] no se pudo generar el título:",
      error instanceof Error ? error.message : error,
    );
  }
}
