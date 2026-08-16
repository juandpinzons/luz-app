import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAIProvider } from "../../../ai";
import type { Database } from "../../../core/db/client";
import { conversations } from "../../../core/db/schema";
import { LIFE_DOMAIN_TYPES } from "../../../core/life";
import { recordEvent } from "../../../core/observability/record-event";

/**
 * Mismo vocabulario que ya agrupa Goal/Project/Habit en `/life`
 * (`LIFE_DOMAIN_TYPES`), más `"general"` para lo que de verdad no cae
 * en ninguna área de vida -- ver el docblock de `ConversationCategory`
 * en `core/db/schema/conversations.ts`, la fuente de verdad de este
 * tipo (no se importa desde ahí para no crear un ciclo schema→feature;
 * el valor válido real es el mismo, verificado por este mismo schema
 * de Zod).
 */
const CONVERSATION_CATEGORIES = [...LIFE_DOMAIN_TYPES, "general"] as const;

/**
 * `max` generoso a propósito -- mismo hallazgo que
 * `AICuriosityQuestionGenerationStrategy` (confirmado contra la API
 * real): OpenAI recorta la salida estructurada al tope exacto en vez
 * de rechazarla. El prompt ya pide "máximo 6 palabras", así que este
 * tope casi nunca debería alcanzarse -- si lo hace, es señal de corte,
 * no un título real.
 */
const TITLE_MAX_CHARS = 80;

const titleSchema = z.object({
  title: z.string().min(1).max(TITLE_MAX_CHARS),
  category: z.enum(CONVERSATION_CATEGORIES),
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
    const { title, category } = await aiProvider.generateStructured(
      [
        {
          role: "system",
          content:
            `Devuelve dos cosas sobre esta conversación:\n` +
            `- "title": un título corto (máximo 6 palabras, sin comillas ni punto final) que resuma de qué trata.\n` +
            `- "category": el área de vida a la que pertenece de verdad -- una de: ${CONVERSATION_CATEGORIES.join(", ")}. Usa "general" solo si de verdad no encaja en ninguna otra (charla casual, preguntas sobre LUZ misma, etc.) -- nunca por defecto.`,
        },
        { role: "user", content: input.userMessage },
        { role: "assistant", content: input.assistantReply },
      ],
      { name: "conversation_title", schema: titleSchema },
    );

    // Si el título llegó exacto al tope del schema, probablemente
    // OpenAI lo cortó a mitad de generación -- se guarda igual la
    // categoría (un valor de enum corto, sin riesgo real de corte) pero
    // `title` se deja en `null`, mismo estado que si esta función nunca
    // hubiera corrido; `previewText` sigue cubriendo la lista de
    // conversaciones.
    const truncated = title.length >= TITLE_MAX_CHARS;

    await db
      .update(conversations)
      .set(truncated ? { category } : { title: title.trim(), category })
      .where(eq(conversations.id, input.conversationId));
  } catch (error) {
    // Antes: console.error plano, invisible a cualquier consulta.
    // `recordEvent` loguea Y persiste en `events` (OBSERVABILITY_PLAN.md:
    // "Fallos de título / Life Capture").
    await recordEvent(db, {
      type: "error",
      route: "background.title",
      message: error instanceof Error ? error.message : String(error),
      metadata: { conversationId: input.conversationId },
    });
  }
}
