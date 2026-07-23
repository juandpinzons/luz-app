import { and, asc, eq } from "drizzle-orm";
import { after } from "next/server";
import { getAIProvider } from "../../../ai";
import type { AIMessage } from "../../../ai/provider";
import { db } from "../../../core/db/client";
import { conversationMessages, conversations } from "../../../core/db/schema";
import type { UserContext } from "../../../core/identity/user-context";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import { createMemoryEngine, type Memory } from "../../../core/memory-engine";
import { enqueueKnowledgeJob } from "../../../core/knowledge/jobs";
import { logger } from "../../../core/observability/logger";
import { recordEvent } from "../../../core/observability/record-event";
import { generateConversationTitle } from "../../conversations/services/generate-title";
import {
  buildContext,
  renderContextToMessages,
} from "../context-builder";
import type { ConversationTurn } from "../context-builder";
import { captureLifeEntityFromMemory } from "../../life/services/life-capture-service";

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

/** `sendMessageStream` devuelve el `conversationId` antes de tocar la IA (ver `prepareMessage`), para que el llamador pueda comprometerse a una respuesta 200 antes de que empiece el streaming. */
export interface SendMessageStreamResult {
  conversationId: string;
  textStream: AsyncGenerator<string, void, void>;
}

interface ConversationRef {
  id: string;
  /** Sprint de títulos automáticos: solo se genera un título en el primer intercambio real de una conversación, nunca en los siguientes. */
  isNew: boolean;
}

async function getOrCreateConversation(
  context: UserContext,
  conversationId?: string,
): Promise<ConversationRef> {
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
      return { id: existing.id, isNew: false };
    }
  }

  const [created] = await db
    .insert(conversations)
    .values({ userId })
    .returning({ id: conversations.id });

  if (!created) {
    throw new Error("No se pudo crear la conversación.");
  }

  return { id: created.id, isNew: true };
}

interface PreparedMessage {
  conversationId: string;
  isNewConversation: boolean;
  userMessageId: string;
  aiMessages: AIMessage[];
  /** Null si la captura en Memory Engine falló o se omitió (sin LifeGraphContext) — en ese caso, Life Capture (`finalizeReply`) tampoco corre, mismo criterio de degradación que el resto del archivo. */
  capturedMemory: Memory | null;
}

/**
 * Todo lo que `sendMessage` ya hacía antes de llamar al proveedor de
 * IA (ADR-0017): persistir el mensaje del usuario, construir el
 * Context explícito (Beta 1 Roadmap, Sprint B3), capturar en Memory
 * Engine. Compartido por `sendMessage` y `sendMessageStream` — ninguna
 * de las dos reimplementa esta parte, ambas la llaman igual.
 */
async function prepareMessage(
  input: SendMessageInput,
): Promise<PreparedMessage> {
  const { context, lifeGraphContext, requestId } = input;

  const conversationRef = await getOrCreateConversation(
    context,
    input.conversationId,
  );
  const conversationId = conversationRef.id;

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
      const builtContext = await buildContext(db, lifeGraphContext, conversation);
      aiMessages = renderContextToMessages(builtContext);
      logger.log({
        event: "context_builder.completed",
        requestId,
        conversationId,
        memoriesCount: builtContext.memories.length,
        rulesApplied: builtContext.conversationRules.length,
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
  let capturedMemory: Memory | null = null;
  if (lifeGraphContext) {
    try {
      capturedMemory = await createMemoryEngine(db).capture(lifeGraphContext, {
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

  return {
    conversationId,
    isNewConversation: conversationRef.isNew,
    userMessageId: userMessage.id,
    aiMessages,
    capturedMemory,
  };
}

interface FinalizeReplyInput {
  context: UserContext;
  lifeGraphContext: LifeGraphContext | null;
  conversationId: string;
  isNewConversation: boolean;
  userMessage: string;
  userMessageId: string;
  requestId?: string;
  startedAt: number;
  reply: string;
  /** La Memory que Memory Engine ya clasificó y rankeó (`prepareMessage`) — único disparador de Life Capture, ver `life-capture-service.ts`. */
  capturedMemory: Memory | null;
}

/**
 * Todo lo que `sendMessage` ya hacía después de obtener la respuesta
 * completa (ADR-0017): persistirla, encolar el Knowledge Engine,
 * registrar el evento. Compartido por `sendMessage` (con la respuesta
 * ya completa) y `sendMessageStream` (con el texto acumulado tras
 * iterar todo el stream) — se llama una sola vez, con el texto final,
 * nunca con fragmentos parciales.
 */
async function finalizeReply(input: FinalizeReplyInput): Promise<void> {
  const {
    context,
    lifeGraphContext,
    conversationId,
    isNewConversation,
    userMessage,
    userMessageId,
    requestId,
    startedAt,
    reply,
    capturedMemory,
  } = input;

  await db.insert(conversationMessages).values({
    conversationId,
    userId: context.userId,
    role: "assistant",
    content: reply,
  });

  // Título automático (Sprint de pulido, Alpha): solo en el primer
  // intercambio real de una conversación nueva — nunca en los
  // siguientes mensajes, y siempre vía `after()` (ADR-0017: esta
  // función corre dentro del `ReadableStream` de `/api/chat`, después
  // de que la respuesta 200 ya empezó a viajar — no puede bloquear ni
  // esperar acá). Si falla, `generateConversationTitle` ya se traga el
  // error: la conversación nunca depende de que esto funcione.
  if (isNewConversation) {
    after(() =>
      generateConversationTitle(db, {
        conversationId,
        userMessage,
        assistantReply: reply,
      }),
    );
  }

  // Persistencia real de Nivel 1 (Goal/Project/Habit/Relationship): a
  // diferencia del título, corre en CADA mensaje, no solo en el
  // primero. Disparada únicamente por lo que Memory Engine ya
  // clasificó y rankeó (`capturedMemory`, de `prepareMessage`) — nunca
  // un análisis independiente de `userMessage`/`reply` (ver
  // life-capture-service.ts: reemplaza a extract-life-entities.ts,
  // que sí hacía eso — un pipeline paralelo, ya retirado). Mismo
  // criterio de contención vía `after()`: nunca bloquea la respuesta,
  // nunca puede romper la conversación. Se omite si la captura de
  // Memory Engine falló o se omitió arriba.
  if (lifeGraphContext && capturedMemory) {
    after(() =>
      captureLifeEntityFromMemory(db, lifeGraphContext, capturedMemory),
    );
  }

  // El Knowledge Engine analiza el mensaje en segundo plano; esta llamada
  // no espera su procesamiento (decisión CTO #6: worker independiente).
  await enqueueKnowledgeJob(db, {
    userId: context.userId,
    sourceType: "conversation_message",
    sourceId: userMessageId,
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
 *
 * No es el camino que usa `/api/chat` desde ADR-0017 (esa ruta usa
 * `sendMessageStream`) — se mantiene como el primitivo sin streaming
 * para cualquier futuro llamador que lo necesite (una CLI, un webhook,
 * un test). No cuesta nada mantenerla: comparte el 100% de su lógica
 * real con `sendMessageStream` a través de `prepareMessage`/
 * `finalizeReply`, así que nunca puede desincronizarse de ella.
 */
export async function sendMessage(
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const startedAt = Date.now();
  const prepared = await prepareMessage(input);

  const aiProvider = getAIProvider();
  const openaiStart = Date.now();
  let reply: string;
  try {
    reply = await aiProvider.generateReply(prepared.aiMessages);
  } catch (error) {
    logger.log({
      event: "openai.request_failed",
      severity: "error",
      requestId: input.requestId,
      conversationId: prepared.conversationId,
      provider: aiProvider.name,
      durationMs: Date.now() - openaiStart,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  logger.log({
    event: "openai.response",
    requestId: input.requestId,
    conversationId: prepared.conversationId,
    provider: aiProvider.name,
    replyLength: reply.length,
    durationMs: Date.now() - openaiStart,
  });

  await finalizeReply({
    context: input.context,
    lifeGraphContext: input.lifeGraphContext,
    conversationId: prepared.conversationId,
    isNewConversation: prepared.isNewConversation,
    userMessage: input.message,
    userMessageId: prepared.userMessageId,
    requestId: input.requestId,
    startedAt,
    reply,
    capturedMemory: prepared.capturedMemory,
  });

  return { conversationId: prepared.conversationId, reply };
}

/**
 * Como `sendMessage`, pero entrega el texto en fragmentos a medida que
 * el modelo los genera (ADR-0017). `conversationId` se resuelve y
 * devuelve de inmediato — antes de tocar la IA — para que el llamador
 * (la ruta) pueda comprometerse a una respuesta 200 con ese id en un
 * header antes de que empiece el cuerpo de la respuesta.
 *
 * `textStream` es perezoso: no llama al proveedor de IA hasta que el
 * llamador empieza a iterarlo. Al terminar de iterarlo con éxito, ya
 * corrió `finalizeReply` con el texto completo acumulado — igual que
 * `sendMessage`, nunca se persiste una respuesta parcial. Si el
 * proveedor falla a mitad de la generación, el error se relanza desde
 * el generador (el llamador lo ve como una excepción al iterar) y
 * `finalizeReply` nunca se ejecuta — ninguna respuesta parcial queda
 * guardada, mismo criterio de todo-o-nada que ya regía el camino sin
 * streaming.
 */
export async function sendMessageStream(
  input: SendMessageInput,
): Promise<SendMessageStreamResult> {
  const startedAt = Date.now();
  const prepared = await prepareMessage(input);
  const aiProvider = getAIProvider();

  async function* generate(): AsyncGenerator<string, void, void> {
    const openaiStart = Date.now();
    let fullReply = "";

    try {
      for await (const chunk of aiProvider.generateReplyStream(
        prepared.aiMessages,
      )) {
        fullReply += chunk;
        yield chunk;
      }
    } catch (error) {
      logger.log({
        event: "openai.request_failed",
        severity: "error",
        requestId: input.requestId,
        conversationId: prepared.conversationId,
        provider: aiProvider.name,
        durationMs: Date.now() - openaiStart,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    logger.log({
      event: "openai.response",
      requestId: input.requestId,
      conversationId: prepared.conversationId,
      provider: aiProvider.name,
      replyLength: fullReply.length,
      durationMs: Date.now() - openaiStart,
    });

    await finalizeReply({
      context: input.context,
      lifeGraphContext: input.lifeGraphContext,
      conversationId: prepared.conversationId,
      isNewConversation: prepared.isNewConversation,
      userMessage: input.message,
      userMessageId: prepared.userMessageId,
      requestId: input.requestId,
      startedAt,
      reply: fullReply,
      capturedMemory: prepared.capturedMemory,
    });
  }

  return { conversationId: prepared.conversationId, textStream: generate() };
}
