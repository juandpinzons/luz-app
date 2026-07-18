import { and, asc, eq } from "drizzle-orm";
import { getAIProvider } from "../../../ai";
import type { AIMessage } from "../../../ai/provider";
import { db } from "../../../core/db/client";
import { conversationMessages, conversations } from "../../../core/db/schema";
import type { UserContext } from "../../../core/identity/user-context";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import { createMemoryEngine } from "../../../core/memory-engine";
import { enqueueKnowledgeJob } from "../../../core/knowledge/jobs";
import { logger } from "../../../core/observability/logger";
import { recordEvent } from "../../../core/observability/record-event";
import {
  buildContext,
  renderContextToMessages,
} from "../context-builder";
import type { ConversationTurn } from "../context-builder";

export interface SendMessageInput {
  context: UserContext;
  /**
   * Null cuando `getLifeGraphContext()` no pudo resolverse (Sprint 07,
   * fallo no crítico ya tolerado en `app/api/chat/route.ts`). Sin esto,
   * la captura en Memory Engine simplemente se omite — el chat nunca
   * depende de que exista (Beta 1 Roadmap, Sprint B1: integración
   * aditiva, nunca un requisito nuevo para que el chat funcione).
   */
  lifeGraphContext: LifeGraphContext | null;
  conversationId?: string;
  message: string;
  /** Para correlacionar logs de un mismo request (Sprint de Observabilidad). */
  requestId?: string;
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
 * Servicio de dominio del chat: persiste la conversación, construye el
 * Context explícito (Beta 1 Roadmap, Sprint B3 — Conversation + Memory
 * + RealitySnapshot + Conversation Manual, nunca una concatenación de
 * texto suelta), captura el mensaje en Memory Engine, llama al
 * proveedor de IA activo y encola el análisis del Knowledge Engine
 * (legado, todavía el pipeline vivo — Sprint B2 no lo reemplazó, ese
 * alcance sigue fuera a propósito). `app/api/chat/route.ts` es un
 * controlador delgado que solo llama a esta función — toda la lógica
 * de negocio vive aquí, en `features/`.
 *
 * Recibe un `UserContext`, nunca un id hardcodeado (Sprint 7): quién es
 * el usuario lo resuelve la Identity Layer (`auth/`) antes de llegar
 * aquí.
 */
export async function sendMessage(
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const { context, lifeGraphContext, requestId } = input;
  const startedAt = Date.now();

  const conversationId = await getOrCreateConversation(
    context,
    input.conversationId,
  );

  logger.log({
    event: "message.received",
    requestId,
    userId: context.userId,
    conversationId,
  });

  const dbWriteStart = Date.now();
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
  logger.log({
    event: "db.query",
    requestId,
    conversationId,
    query: "insert_user_message_and_fetch_history",
    durationMs: Date.now() - dbWriteStart,
  });

  // `conversation_messages.role` admite "system" en el schema (headroom
  // sin uso hoy — nada lo inserta) pero `ConversationTurn` solo modela
  // turnos reales de la conversación; una fila "system", si alguna vez
  // existe, no es un turno, es una instrucción — se filtra aquí, nunca
  // se cuela al Context Builder con la forma equivocada.
  const conversation: ConversationTurn[] = history
    .filter(
      (entry): entry is typeof entry & { role: "user" | "assistant" } =>
        entry.role === "user" || entry.role === "assistant",
    )
    .map((entry) => ({
      role: entry.role,
      content: entry.content,
    }));

  // Context Builder (Beta 1 Roadmap, Sprint B3): construido ANTES de
  // capturar este mensaje en Memory — mismo criterio ya establecido en
  // Sprint B2, ahora aplicado al Context completo: el mensaje que se
  // está respondiendo nunca debe aparecer en sus propias "memorias
  // relevantes" (tabla distinta a `conversation_messages`, así que el
  // historial ya puede incluir este mensaje sin ese riesgo). Un fallo
  // aquí no debe romper el chat — se degrada al historial simple, sin
  // reglas ni memoria, exactamente el comportamiento anterior a este
  // sprint.
  let aiMessages: AIMessage[] = conversation;
  if (lifeGraphContext) {
    const contextBuilderStart = Date.now();
    try {
      const context = await buildContext(db, lifeGraphContext, conversation);
      aiMessages = renderContextToMessages(context);
      logger.log({
        event: "context_builder.completed",
        requestId,
        conversationId,
        memoriesCount: context.memories.length,
        rulesApplied: context.conversationRules.length,
        durationMs: Date.now() - contextBuilderStart,
      });
    } catch (error) {
      logger.log({
        event: "context_builder.failed",
        severity: "error",
        requestId,
        conversationId,
        durationMs: Date.now() - contextBuilderStart,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Memory Engine (Beta 1 Roadmap, Sprint B1): captura el mensaje como
  // evidencia real — ranqueada y conectada por Memory Engine, no solo
  // guardada como texto de historial. Aditivo: `conversationMessages`
  // sigue siendo el historial que renderiza el chat; esto es la
  // primera vez que ese contenido también se vuelve Memory real.
  // Deliberadamente después de construir el Context, no antes (ver
  // arriba), y antes de llamar al proveedor de IA: el mensaje del
  // usuario se captura sin importar si la IA responde con éxito. Un
  // fallo aquí nunca debe romper el chat — mismo criterio que ya usa
  // la resolución de `LifeGraphContext`.
  if (lifeGraphContext) {
    try {
      await createMemoryEngine(db).capture(lifeGraphContext, {
        content: input.message,
        source: "conversation",
        sourceId: userMessage.id,
        personId: lifeGraphContext.personId,
        occurredAt: userMessage.createdAt,
      });
    } catch (error) {
      console.error("[send-message] no se pudo capturar Memory:", error);
    }
  }

  const aiProvider = getAIProvider();
  const openaiStart = Date.now();
  let reply: string;
  try {
    reply = await aiProvider.generateReply(aiMessages);
  } catch (error) {
    logger.log({
      event: "openai.request_failed",
      severity: "error",
      requestId,
      conversationId,
      provider: aiProvider.name,
      durationMs: Date.now() - openaiStart,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  logger.log({
    event: "openai.response",
    requestId,
    conversationId,
    provider: aiProvider.name,
    replyLength: reply.length,
    durationMs: Date.now() - openaiStart,
  });

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

  const totalDurationMs = Date.now() - startedAt;
  logger.log({
    event: "message.sent",
    requestId,
    userId: context.userId,
    conversationId,
    durationMs: totalDurationMs,
  });
  await recordEvent(db, {
    type: "message_sent",
    userId: context.userId,
    metadata: { conversationId, durationMs: totalDurationMs },
  });

  return { conversationId, reply };
}
