import { and, desc, eq } from "drizzle-orm";
import { after } from "next/server";
import { getAIProvider } from "../../../ai";
import type { AIMessage } from "../../../ai/provider";
import { contextItemKey } from "../../../core/context-engine";
import { db } from "../../../core/db/client";
import { conversationMessages, conversations } from "../../../core/db/schema";
import type { UserContext } from "../../../core/identity/user-context";
import type { EntityId } from "../../../core/life/value-objects/entity-id";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import { createMemoryEngine, extractOccurredAt, type Memory } from "../../../core/memory-engine";
import { MIN_SCORE_WITH_UNDERSTANDING_SIGNAL } from "../../../core/memory-engine/ranking/deterministic-memory-ranking-strategy";
import { enqueueKnowledgeJob } from "../../../core/knowledge/jobs";
import { describeError } from "../../../core/observability/describe-error";
import { logger } from "../../../core/observability/logger";
import { recordEvent } from "../../../core/observability/record-event";
import { logTraceSummary, runTrace, span } from "../../../core/observability/trace";
import { DrizzleSeenPromptRepository, SEEN_PROMPT_SUBJECT_TYPES } from "../../../core/seen-prompts";
import { decryptContent, encryptContent, encryptContentOrNull } from "../../../core/security/content-cipher";
import { generateConversationTitle } from "../../conversations/services/generate-title";
import { detectCrisisSignal, CRISIS_RESOURCE_MESSAGE } from "./detect-crisis-signal";
import { detectImageGenerationRequest } from "./detect-image-generation-request";
import {
  buildContext,
  renderContextToMessages,
  recordConversationSignalShown,
  type ConversationSignal,
} from "../context-builder";
import type { ConversationTurn } from "../context-builder";
import { captureLifeEntityFromMemory } from "../../life/services/life-capture-service";

/**
 * Ventana máxima de `conversation_messages` crudos que se leen de una
 * conversación para construir `aiMessages` (auditoría War Room
 * 2026-07-29): sin límite, una conversación larga reenvía TODO su
 * historial en cada turno -- reproducido contra Postgres/OpenAI reales
 * con 1200 mensajes sintéticos: ~105k tokens solo de historial, antes
 * de identidad/reglas/memorias/estrategia, y ese costo crece sin techo
 * con cada mensaje nuevo hasta, eventualmente, exceder la ventana de
 * contexto real del modelo -- un fallo permanente para esa
 * conversación, porque cualquier reintento reenvía el mismo historial
 * (o uno más grande) y falla igual.
 *
 * 60 mensajes (~30 turnos ida y vuelta) es generoso para coherencia
 * conversacional inmediata -- "¿qué acabamos de hablar?" -- sin
 * competir con la comprensión de largo plazo, que nunca depende de
 * esto: esa vive en Memory Engine/RealitySnapshot (ADR-0013),
 * consultados aparte y ya acotados. Ningún callback lo pasa hoy en 10
 * mensajes, así que esta ventana no cambia el comportamiento de
 * ninguna conversación real todavía -- solo pone un techo real al caso
 * patológico.
 */
const MAX_HISTORY_MESSAGES = 60;

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
  /** Data URI completa (`data:image/jpeg;base64,...`) de una imagen adjunta a este turno -- opcional, ver `AIMessage.imageDataUri`. */
  image?: string;
  /** Para correlacionar logs de un mismo request (Sprint de Observabilidad). */
  requestId?: string;
  /** Tag de `route` para `events` (`message_sent`/`error` quedan agrupables por ruta -- OBSERVABILITY_PLAN.md). */
  route: string;
}

export interface SendMessageResult {
  conversationId: string;
  reply: string;
  imageData?: string;
}

/**
 * `sendMessageStream` devuelve el `conversationId` antes de tocar la IA
 * (ver `prepareMessage`), para que el llamador pueda comprometerse a
 * una respuesta 200 antes de que empiece el streaming.
 *
 * `backgroundTasksReady` resuelve (con las tareas de fondo de
 * `finalizeReply`, o `[]` si el stream falló antes de llegar ahí) una
 * vez que `textStream` termina de generarse — el llamador
 * (`app/api/chat/route.ts`) debe registrar su propio `after()` ANTES
 * de devolver el `Response`, todavía en scope de la petición, y
 * esperar esta promesa desde ahí. Nunca queda sin resolver: ver el
 * `catch` que envuelve todo el cuerpo de `generate()`.
 */
export interface SendMessageStreamResult {
  conversationId: string;
  textStream: AsyncGenerator<string, void, void>;
  backgroundTasksReady: Promise<Promise<unknown>[]>;
  /** Ver docblock junto a `resolveImageReady`, dentro de `sendMessageStream`. */
  imageReady: Promise<string | undefined>;
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

/**
 * Qué fila de `seen_prompts` marcar tras esta respuesta -- `reopen`/
 * `acknowledge_closure` (redesign del pipeline conversacional, Beta)
 * son las únicas estrategias que necesitan esto: ganar el turno una
 * vez ya es "mostrarlo", nunca debe volver a ganar para el mismo
 * sujeto.
 */
interface SeenPromptToMark {
  subjectType: string;
  subjectId: EntityId;
}

interface PreparedMessage {
  conversationId: string;
  isNewConversation: boolean;
  aiMessages: AIMessage[];
  /** Null si la captura en Memory Engine falló o se omitió (sin LifeGraphContext) — en ese caso, Life Capture (`finalizeReply`) tampoco corre, mismo criterio de degradación que el resto del archivo. */
  capturedMemory: Memory | null;
  /**
   * Qué decidió Context Builder para este turno (redesign del pipeline
   * conversacional, Beta) -- null en el mismo caso que degrada
   * `aiMessages` al historial simple: sin Context construido, no hay
   * nada real que registrar como señal de diversidad.
   */
  conversationSignal: ConversationSignal | null;
  /** Null salvo que la estrategia ganadora sea `reopen`/`acknowledge_closure`. */
  seenPromptToMark: SeenPromptToMark | null;
  /** Ver `detect-crisis-signal.ts` -- calculado una sola vez aquí, consumido igual por `sendMessage`/`sendMessageStream`. */
  crisisSignalDetected: boolean;
  /** Ver `detect-image-generation-request.ts` -- `null` si este turno no pide generar una imagen. */
  imageRequestPrompt: string | null;
}

/**
 * Todo lo que `sendMessage` ya hacía antes de llamar al proveedor de
 * IA (ADR-0017): persistir el mensaje del usuario, construir el
 * Context explícito (Beta 1 Roadmap, Sprint B3), capturar en Memory
 * Engine. Compartido por `sendMessage` y `sendMessageStream` — ninguna
 * de las dos reimplementa esta parte, ambas la llaman igual.
 */
async function prepareMessageInner(
  input: SendMessageInput,
): Promise<PreparedMessage> {
  const { context, lifeGraphContext, requestId } = input;

  const conversationRef = await span("Conversation.getOrCreate", "repository", () =>
    getOrCreateConversation(context, input.conversationId),
  );
  const conversationId = conversationRef.id;

  logger.log({
    event: "message.received",
    requestId,
    userId: context.userId,
    conversationId,
  });

  // Red de seguridad de crisis (War Room 13-ago-2026, terremoto de
  // Cali) -- se calcula sobre el mensaje crudo, antes que cualquier
  // otra cosa en esta función, para que ni un fallo de Context
  // Builder/Memory Engine más abajo pueda dejarla sin correr. Se
  // registra aquí (nunca con el contenido del mensaje, ver docblock del
  // enum) independientemente de si la IA llega a responder con éxito --
  // el Founder necesita el conteo real, no solo los casos que además
  // tuvieron una respuesta exitosa.
  const crisisSignalDetected = detectCrisisSignal(input.message);
  // Ver `detect-image-generation-request.ts` -- determinista, calculado sobre el mensaje
  // crudo igual que la señal de crisis. La generación real (llamada a OpenAI) pasa después
  // de tener la respuesta de texto (`finalizeReply`/`sendMessage`/`sendMessageStream`), nunca
  // acá -- esta función solo prepara, no genera nada todavía.
  const imageRequestPrompt = detectImageGenerationRequest(input.message);
  if (crisisSignalDetected) {
    logger.log({
      event: "crisis_signal.detected",
      severity: "warn",
      requestId,
      userId: context.userId,
      conversationId,
    });
    await recordEvent(db, {
      type: "crisis_signal_detected",
      userId: context.userId,
      route: input.route,
      metadata: { conversationId, requestId },
    });
  }

  const dbWriteStart = Date.now();
  const { userMessage, history } = await span("Conversation.persistMessage", "repository", async () => {
    const [inserted] = await db
      .insert(conversationMessages)
      .values({
        conversationId,
        userId: context.userId,
        role: "user",
        content: encryptContent(input.message),
        imageData: encryptContentOrNull(input.image),
      })
      .returning();

    if (!inserted) {
      throw new Error("No se pudo guardar el mensaje del usuario.");
    }

    // Los `MAX_HISTORY_MESSAGES` más recientes, no los primeros -- una
    // conversación larga debe recordar lo último que se dijo, nunca
    // truncar por el principio. Se pide en orden descendente (más
    // reciente primero) para que `LIMIT` recorte el extremo correcto, y
    // se revierte después: todo lo que consume `history` de aquí en
    // adelante (`conversation`, Context Builder, `renderContextToMessages`)
    // espera orden cronológico.
    const recentHistory = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(desc(conversationMessages.createdAt))
      .limit(MAX_HISTORY_MESSAGES);

    // Descifrado inmediatamente al salir de la base -- de aquí en
    // adelante `history` (y todo lo que se construya desde ella, como
    // `conversation` más abajo) siempre está en texto plano (ADR-0024).
    const decryptedHistory = recentHistory.map((row) => ({
      ...row,
      content: decryptContent(row.content),
    }));

    return { userMessage: inserted, history: decryptedHistory.reverse() };
  });
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
  let conversationSignal: ConversationSignal | null = null;
  let seenPromptToMark: SeenPromptToMark | null = null;
  if (lifeGraphContext) {
    const contextBuilderStart = Date.now();
    try {
      const builtContext = await buildContext(
        db,
        lifeGraphContext,
        conversation,
        context.userId,
      );
      aiMessages = renderContextToMessages(builtContext);
      conversationSignal = {
        conversationId,
        strategy: builtContext.conversationStrategy.strategy,
        topContextItemKeys: builtContext.contextItems
          .map((item) => contextItemKey(item))
          .filter((key): key is string => key !== null),
      };
      // Redesign del pipeline conversacional (Beta): `reopen`/
      // `acknowledge_closure` ganaron leyendo `items[0]` de una lista
      // ya filtrada por `seen_prompts` (`assembleRealitySnapshot`) --
      // re-derivar ese mismo ganador aquí, del mismo `realitySnapshot`
      // ya construido, es consistente por construcción (nada lo muta
      // entre la decisión y este punto), sin ensanchar
      // `ConversationStrategyDirective` con un campo que solo estas dos
      // estrategias necesitan.
      if (builtContext.conversationStrategy.strategy === "reopen") {
        const winner = builtContext.realitySnapshot.reopenCandidates.items[0];
        if (winner) {
          seenPromptToMark = {
            subjectType: SEEN_PROMPT_SUBJECT_TYPES.intentionFollowup,
            subjectId: winner.id,
          };
        }
      } else if (builtContext.conversationStrategy.strategy === "acknowledge_closure") {
        const winner = builtContext.realitySnapshot.closures.items[0];
        if (winner) {
          seenPromptToMark = {
            subjectType: SEEN_PROMPT_SUBJECT_TYPES.goalClosure,
            subjectId: winner.id,
          };
        }
      }
      logger.log({
        event: "context_builder.completed",
        requestId,
        conversationId,
        memoriesCount: builtContext.memories.length,
        contextItemsCount: builtContext.contextItems.length,
        conversationStrategy: builtContext.conversationStrategy.strategy,
        presenceMode: builtContext.presence.mode,
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

  // La imagen adjunta viaja SOLO en el último mensaje de `aiMessages` --
  // el turno actual, siempre al final por construcción tanto en el
  // camino de Context Builder (`renderContextToMessages`, system
  // primero, `context.conversation` al final) como en el de respaldo
  // (`aiMessages = conversation` sin tocar, arriba): ambos terminan en
  // el mismo `ConversationTurn` que se acaba de insertar, con el
  // timestamp más reciente. Nunca se adjunta a un mensaje de historial
  // -- eso reenviaría la misma imagen a OpenAI en cada turno siguiente
  // de la conversación, cada vez más caro sin ningún beneficio real.
  if (input.image) {
    const lastMessage = aiMessages[aiMessages.length - 1];
    if (lastMessage) {
      lastMessage.imageDataUri = input.image;
    }
  }

  // Sin esto, el reply de texto (LLM, sin saber que el código YA va a generar
  // una imagen este mismo turno -- ver `imageRequestPrompt`/`tryGenerateImage`
  // más abajo) suele preguntar "¿qué estilo prefieres?" en el mismo mensaje
  // donde la imagen ya llega -- redundante e incoherente, la persona ve la
  // imagen Y una pregunta sobre algo que ya pasó. Una sola instrucción de
  // sistema, insertada justo antes del turno actual (misma posición que la
  // imagen adjunta arriba) resuelve esto sin una segunda llamada a IA solo
  // para decidir "¿debería preguntar primero?".
  if (imageRequestPrompt) {
    aiMessages.splice(aiMessages.length - 1, 0, {
      role: "system",
      content:
        "Ya vas a generar y mostrar una imagen en tu respuesta a este mensaje -- el sistema la adjunta automáticamente, vos no la generás. No preguntes por estilo, colores, ni ningún otro detalle antes de mostrarla: usa tu propio criterio para interpretar el pedido y comenta la imagen con calidez una vez lista, como si ya la hubieras visto. Si de verdad la persona quiere otra versión, puede pedirla en un mensaje después.",
    });
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
      // Determinístico, no una llamada a IA -- síncrono, sin costo real
      // de latencia (mismo criterio que `detectCrisisSignal`, un turno
      // de chat nunca paga el costo de una extracción con IA acá, ver
      // docblock de `extractOccurredAt`). Si el contenido no menciona
      // ninguna fecha, cae exactamente al comportamiento de siempre.
      const occurredAt =
        extractOccurredAt(input.message, userMessage.createdAt) ?? userMessage.createdAt;

      capturedMemory = await span("Memory.capture", "engine", () =>
        createMemoryEngine(db).capture(lifeGraphContext, {
          content: input.message,
          source: "conversation",
          sourceId: userMessage.id,
          personId: lifeGraphContext.personId,
          occurredAt,
        }),
      );
    } catch (error) {
      // Mismo criterio que `life-capture-service.ts` (auditoría
      // 2026-07-25, OBSERVABILITY_PLAN.md, endurecido 2026-08-14):
      // detalle completo (`errorStack`/`errorQuery`) solo a consola vía
      // `describeError` -- nunca a `events.metadata`, que persiste y es
      // consultable desde /admin (cardinalidad no acotada; `describeError`
      // ya ni siquiera devuelve los valores de parámetros SQL, solo la
      // consulta). Un fallo de captura aquí es más
      // grave que uno de título (nada río abajo -- Knowledge Worker,
      // RealitySnapshot, todo el pipeline -- ve este mensaje si Memory
      // Engine no lo capturó).
      const detail = describeError(error);
      logger.log({
        event: "background.memory_capture.failed",
        severity: "error",
        requestId,
        conversationId,
        ...detail,
      });
      await recordEvent(db, {
        type: "error",
        userId: context.userId,
        route: "background.memory_capture",
        message: error instanceof Error ? error.message : String(error),
        metadata: {
          conversationId,
          requestId,
          errorName: detail.errorName,
          errorCode: detail.errorCode,
        },
      });
    }
  }

  return {
    conversationId,
    isNewConversation: conversationRef.isNew,
    aiMessages,
    capturedMemory,
    conversationSignal,
    seenPromptToMark,
    crisisSignalDetected,
    imageRequestPrompt,
  };
}

/**
 * Envoltorio delgado de `prepareMessageInner` -- misión "complete
 * latency profile": todo lo que corre antes de tocar la IA (persistir
 * el mensaje, Reality/Memory/Knowledge/Identity Evolution vía Context
 * Builder, Context Engine, Conversation Strategy, Presence, Voice,
 * Reconnection/Narrative/Continuity) queda en una sola traza real
 * (`chat.prepare_context`). Nunca cambia el resultado ni los errores --
 * `runTrace` relanza tal cual lo que `prepareMessageInner` lance.
 */
/**
 * Nunca lanza -- una imagen es un extra sobre la respuesta de texto,
 * nunca un requisito para que el turno se complete (mismo criterio de
 * tolerancia a fallos que Memory Engine/Context Builder en el resto de
 * este archivo). `undefined` en caso de error, nunca un mensaje de
 * error fabricado dentro de la respuesta de LUZ -- la persona ve su
 * texto normal sin la imagen, no una disculpa inventada.
 */
async function tryGenerateImage(
  aiProvider: ReturnType<typeof getAIProvider>,
  prompt: string,
  context: { userId: string; requestId?: string; conversationId: string },
): Promise<string | undefined> {
  const startedAt = Date.now();
  try {
    const image = await aiProvider.generateImage(prompt);
    logger.log({
      event: "image_generation.completed",
      requestId: context.requestId,
      conversationId: context.conversationId,
      durationMs: Date.now() - startedAt,
    });
    return image;
  } catch (error) {
    logger.log({
      event: "image_generation.failed",
      severity: "error",
      requestId: context.requestId,
      conversationId: context.conversationId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

async function prepareMessage(input: SendMessageInput): Promise<PreparedMessage> {
  const { result, summary } = await runTrace(
    input.requestId ?? "unknown",
    "chat.prepare_context",
    () => prepareMessageInner(input),
  );
  logTraceSummary(summary, { conversationId: result.conversationId, route: input.route });
  return result;
}

interface FinalizeReplyInput {
  context: UserContext;
  lifeGraphContext: LifeGraphContext | null;
  conversationId: string;
  isNewConversation: boolean;
  userMessage: string;
  requestId?: string;
  startedAt: number;
  reply: string;
  /** Ya generada (o `undefined` si este turno no la pedía, o si `generateImage` falló) -- `finalizeReply` solo persiste, nunca genera. */
  imageData?: string;
  /** La Memory que Memory Engine ya clasificó y rankeó (`prepareMessage`) — único disparador de Life Capture y de Knowledge Engine, ver `life-capture-service.ts` y `core/knowledge-engine`. Reemplaza a `userMessageId`, que ya no se usa acá (P0, cierre del Alpha: Knowledge Engine se dispara por Memory, no por el mensaje crudo). */
  capturedMemory: Memory | null;
  /** Qué decidió Context Builder este turno (`prepareMessage`) -- ver docblock de `PreparedMessage.conversationSignal`. */
  conversationSignal: ConversationSignal | null;
  /** Ver docblock de `SeenPromptToMark`. */
  seenPromptToMark: SeenPromptToMark | null;
  /** `route.ts` usa el mismo valor para taggear `error` en esta ruta -- así ambos son consultables juntos (OBSERVABILITY_PLAN.md). */
  route: string;
  /** Solo en el camino con streaming: ms desde `startedAt` hasta el primer chunk yielded. `undefined` en `sendMessage` -- ahí "primer token" y "duración total" son el mismo número, no hay nada nuevo que medir. */
  firstTokenMs?: number;
}

/**
 * Todo lo que `sendMessage` ya hacía después de obtener la respuesta
 * completa (ADR-0017): persistirla, encolar el Knowledge Engine,
 * registrar el evento. Compartido por `sendMessage` (con la respuesta
 * ya completa) y `sendMessageStream` (con el texto acumulado tras
 * iterar todo el stream) — se llama una sola vez, con el texto final,
 * nunca con fragmentos parciales.
 */
/**
 * Ya no llama a `after()` directamente (causa real de los 25 errores
 * "`after` was called outside a request scope" en producción, todos
 * en `POST /api/chat`): esta función corre dentro del `ReadableStream`
 * de la ruta con streaming (`sendMessageStream` → `generate()` →
 * `pull()`), y ahí `after()` pierde el scope de la petición original
 * porque pasa por la maquinaria interna de `ReadableStream` — Next.js
 * lo rechaza en runtime, no en build. La programación real vía
 * `after()` la hace el llamador (`sendMessage` o
 * `app/api/chat/route.ts`), que sí sigue en scope válido; esta función
 * solo arranca las tareas y devuelve sus promesas.
 */
async function finalizeReplyInner(
  input: FinalizeReplyInput,
): Promise<{ backgroundTasks: Promise<unknown>[] }> {
  const {
    context,
    lifeGraphContext,
    conversationId,
    isNewConversation,
    userMessage,
    requestId,
    startedAt,
    reply,
    imageData,
    capturedMemory,
    conversationSignal,
    seenPromptToMark,
    route,
    firstTokenMs,
  } = input;

  // Independientes entre sí (misión "complete latency profile", ítem
  // de roadmap #4): `recordConversationSignalShown` escribe a `events`
  // usando `conversationSignal` (ya resuelto por `prepareMessage`) y
  // `userId` -- nunca lee ni depende de la fila que `persistReply`
  // inserta en `conversation_messages`. Antes se esperaban una detrás
  // de otra sin que ninguna necesitara el resultado de la otra, mismo
  // patrón ya corregido esta sesión en `app/dashboard/page.tsx`.
  await Promise.all([
    span("Conversation.persistReply", "repository", () =>
      db.insert(conversationMessages).values({
        conversationId,
        userId: context.userId,
        role: "assistant",
        content: encryptContent(reply),
        imageData: encryptContentOrNull(imageData),
      }),
    ),
    // Diversidad conversacional (redesign del pipeline conversacional,
    // Beta): registrado solo tras una respuesta exitosa -- mismo
    // criterio que el resto de `finalizeReply`, nunca antes de saber
    // que el turno de verdad se completó. Tolerante a fallos
    // (`recordEvent` ya nunca lanza), mismo criterio que `message_sent`
    // más abajo.
    conversationSignal
      ? span("Conversation.recordSignal", "repository", () =>
          recordConversationSignalShown(db, context.userId, conversationSignal),
        )
      : Promise.resolve(),
  ]);

  // `reopen`/`acknowledge_closure` ganaron el turno -- marcar el
  // sujeto como visto para que nunca vuelva a ganar (`seen_prompts`,
  // `docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md` §5.3). Requiere
  // `lifeGraphContext` real (`seen_prompts.lifeGraphId`, no `userId`);
  // sin él, `seenPromptToMark` siempre es `null` de todas formas (se
  // deriva dentro del mismo `if (lifeGraphContext)` en `prepareMessage`).
  // Tolerante a fallos, mismo criterio que el resto de este archivo: un
  // error aquí en el peor caso repite un reconocimiento una vez más, no
  // debe tumbar la respuesta que la persona ya recibió.
  if (seenPromptToMark && lifeGraphContext) {
    try {
      await span("SeenPrompts.markSeen", "repository", () =>
        new DrizzleSeenPromptRepository(db).markSeen(
          lifeGraphContext,
          seenPromptToMark.subjectType,
          seenPromptToMark.subjectId,
        ),
      );
    } catch (error) {
      logger.log({
        event: "background.seen_prompt_mark.failed",
        severity: "error",
        requestId,
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const backgroundTasks: Promise<unknown>[] = [];

  // Título automático (Sprint de pulido, Alpha): solo en el primer
  // intercambio real de una conversación nueva — nunca en los
  // siguientes mensajes. `generateConversationTitle` ya se traga
  // cualquier error internamente: la conversación nunca depende de que
  // esto funcione.
  if (isNewConversation) {
    backgroundTasks.push(
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
  // que sí hacía eso — un pipeline paralelo, ya retirado).
  // `captureLifeEntityFromMemory` también se traga sus propios errores.
  // Se omite si la captura de Memory Engine falló o se omitió arriba.
  if (lifeGraphContext && capturedMemory) {
    backgroundTasks.push(
      captureLifeEntityFromMemory(db, lifeGraphContext, capturedMemory),
    );
  }

  // El Knowledge Engine analiza en segundo plano (worker independiente,
  // decisión CTO #6) — pero disparado por la Memory que Memory Engine ya
  // clasificó y rankeó, no por el mensaje crudo (mismo criterio que Life
  // Capture, arriba: un solo origen de verdad, Conversación → Memory
  // Engine → Knowledge Engine). Sin señal real de comprensión, no hay
  // nada que interpretar todavía — no se encola (evita que la cola crezca
  // con trabajo que Validate rechazaría de todas formas por falta de
  // evidencia real).
  if (
    capturedMemory &&
    (capturedMemory.rank?.score ?? 0) >= MIN_SCORE_WITH_UNDERSTANDING_SIGNAL
  ) {
    // Solo encola la fila -- el análisis real del Knowledge Engine
    // (enriquecimiento, Belief/Concept/Contradiction) corre después, en
    // `worker/` (proceso aparte, decisión CTO #6), genuinamente fuera de
    // la vida de esta petición HTTP -- no medible dentro de esta traza,
    // documentado como límite conocido del perfil (ver README).
    await span("Knowledge.enqueue", "repository", () =>
      enqueueKnowledgeJob(db, {
        userId: context.userId,
        sourceType: "memory",
        sourceId: capturedMemory.id,
      }),
    );
  }

  const totalDurationMs = Date.now() - startedAt;
  logger.log({
    event: "message.sent",
    requestId,
    userId: context.userId,
    conversationId,
    durationMs: totalDurationMs,
    firstTokenMs,
  });
  await recordEvent(db, {
    type: "message_sent",
    userId: context.userId,
    route,
    metadata: { conversationId, durationMs: totalDurationMs, firstTokenMs },
  });

  return { backgroundTasks };
}

/**
 * Envoltorio delgado de `finalizeReplyInner` -- misión "complete
 * latency profile": persistir la respuesta, registrar la señal de
 * diversidad, marcar `seen_prompts`, encolar Knowledge Engine, todo en
 * su propia traza (`chat.finalize`), separada de `chat.prepare_context`
 * a propósito -- ambas ya se completan sincrónicamente dentro de
 * `generate()`, así que una sola traza combinada las mediría bien de
 * todas formas, pero mantenerlas separadas dista de asumir nada nuevo
 * sobre esa arquitectura: si algún día `finalizeReply` se mueve a
 * correr fuera de línea (post-respuesta), esta separación ya está
 * lista para esa realidad, sin necesitar otro cambio.
 *
 * Las tareas de `backgroundTasks` (título, Life Capture) NUNCA se
 * miden aquí -- se disparan (`push`) pero nunca se esperan dentro de
 * esta función, corren de verdad después de que la traza ya cerró (vía
 * `after()` en el llamador). Medirlas exigiría una traza que sobreviva
 * al cierre de esta función, fuera de alcance de esta misión --
 * documentado como límite conocido, no un olvido.
 */
/**
 * Tablero de salud diario, auditoría de seguridad 2026-08-14: la base
 * de "timeouts/429/500" -- el SDK de OpenAI adjunta `status` (HTTP) a
 * sus errores reales; los de conexión/timeout no traen `status`, se
 * distinguen por nombre. `"error"` es el resto (fallo de red genérico,
 * respuesta sin contenido, etc.) -- nunca se descarta un caso a costa
 * de fingir certeza sobre su causa.
 */
function classifyAiOutcome(error: unknown): "timeout" | "rate_limited" | "server_error" | "error" {
  if (error && typeof error === "object") {
    const err = error as { status?: number; name?: string; code?: string };
    if (err.name === "APIConnectionTimeoutError" || err.code === "ETIMEDOUT") {
      return "timeout";
    }
    if (err.status === 429) {
      return "rate_limited";
    }
    if (err.status !== undefined && err.status >= 500) {
      return "server_error";
    }
  }
  return "error";
}

/**
 * Un `ai_call_completed` por llamada real al proveedor -- éxito o
 * falla, siempre. `inputLength` es la suma de `content.length` de
 * todo lo que se le mandó al modelo (system + conversación), no solo
 * el mensaje nuevo -- lo que de verdad determina costo/latencia de la
 * llamada. Sin conteo de tokens/costo real: `AIProvider.generateReply`
 * (`ai/provider.ts`) devuelve solo `string` a propósito (ADR de
 * reemplazabilidad de LLM -- ningún proveedor debe filtrar su forma de
 * `usage` al contrato compartido); duración + tamaño de entrada/salida
 * son la aproximación disponible sin tocar esa interfaz.
 */
async function recordAiCallEvent(input: {
  userId: string;
  outcome: "success" | "timeout" | "rate_limited" | "server_error" | "error";
  durationMs: number;
  inputLength: number;
  replyLength?: number;
}): Promise<void> {
  await recordEvent(db, {
    type: "ai_call_completed",
    userId: input.userId,
    metadata: {
      outcome: input.outcome,
      durationMs: input.durationMs,
      inputLength: input.inputLength,
      replyLength: input.replyLength,
    },
  });
}

async function finalizeReply(
  input: FinalizeReplyInput,
): Promise<{ backgroundTasks: Promise<unknown>[] }> {
  const { result, summary } = await runTrace(
    input.requestId ?? "unknown",
    "chat.finalize",
    () => finalizeReplyInner(input),
  );
  logTraceSummary(summary, { conversationId: input.conversationId, route: input.route });
  return result;
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
  const inputLength = prepared.aiMessages.reduce((sum, message) => sum + message.content.length, 0);
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
    await recordAiCallEvent({
      userId: input.context.userId,
      outcome: classifyAiOutcome(error),
      durationMs: Date.now() - openaiStart,
      inputLength,
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
  await recordAiCallEvent({
    userId: input.context.userId,
    outcome: "success",
    durationMs: Date.now() - openaiStart,
    inputLength,
    replyLength: reply.length,
  });

  // Agregado por código, nunca pedido al LLM -- ver `detect-crisis-signal.ts`.
  if (prepared.crisisSignalDetected) {
    reply = `${reply}\n\n${CRISIS_RESOURCE_MESSAGE}`;
  }

  // Ver `detect-image-generation-request.ts` -- después de la respuesta de
  // texto, nunca antes: si la generación de imagen falla o tarda, el
  // texto ya está listo y no depende de ella.
  const imageData = prepared.imageRequestPrompt
    ? await tryGenerateImage(aiProvider, prepared.imageRequestPrompt, {
        userId: input.context.userId,
        requestId: input.requestId,
        conversationId: prepared.conversationId,
      })
    : undefined;

  // Sin streaming de por medio: esta función corre síncronamente dentro
  // del scope de la petición original de `app/api/chat/route.ts`, así
  // que `after()` sí es válido acá (a diferencia de `sendMessageStream`,
  // ver `finalizeReply`).
  const { backgroundTasks } = await finalizeReply({
    context: input.context,
    lifeGraphContext: input.lifeGraphContext,
    conversationId: prepared.conversationId,
    isNewConversation: prepared.isNewConversation,
    userMessage: input.message,
    requestId: input.requestId,
    startedAt,
    reply,
    imageData,
    capturedMemory: prepared.capturedMemory,
    conversationSignal: prepared.conversationSignal,
    seenPromptToMark: prepared.seenPromptToMark,
    route: input.route,
  });
  after(() => Promise.all(backgroundTasks));

  return { conversationId: prepared.conversationId, reply, imageData };
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

  let resolveBackgroundTasks!: (tasks: Promise<unknown>[]) => void;
  const backgroundTasksReady = new Promise<Promise<unknown>[]>((resolve) => {
    resolveBackgroundTasks = resolve;
  });

  /**
   * Mismo patrón que `backgroundTasksReady` -- resuelve una sola vez,
   * con la imagen ya generada (o `undefined`: no se pidió, o falló) DESPUÉS
   * de que el stream de texto termina. `app/api/chat/route.ts` la espera
   * justo antes de cerrar el stream SSE, para mandar un evento `image`
   * final si hay algo que mandar.
   */
  let resolveImageReady!: (image: string | undefined) => void;
  const imageReady = new Promise<string | undefined>((resolve) => {
    resolveImageReady = resolve;
  });

  async function* generate(): AsyncGenerator<string, void, void> {
    const openaiStart = Date.now();
    const inputLength = prepared.aiMessages.reduce((sum, message) => sum + message.content.length, 0);
    let fullReply = "";
    let firstChunkAt: number | undefined;

    try {
      try {
        for await (const chunk of aiProvider.generateReplyStream(
          prepared.aiMessages,
        )) {
          firstChunkAt ??= Date.now();
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
        await recordAiCallEvent({
          userId: input.context.userId,
          outcome: classifyAiOutcome(error),
          durationMs: Date.now() - openaiStart,
          inputLength,
        });
        throw error;
      }

      // Agregado por código, nunca pedido al LLM -- ver
      // `detect-crisis-signal.ts`. Un chunk SSE más, como cualquier otro
      // fragmento de la respuesta -- el cliente no distingue su origen,
      // y `fullReply` (lo que persiste `finalizeReply`) queda con el
      // texto completo realmente mostrado, nunca solo la parte del LLM.
      if (prepared.crisisSignalDetected) {
        const resourceChunk = `\n\n${CRISIS_RESOURCE_MESSAGE}`;
        fullReply += resourceChunk;
        yield resourceChunk;
      }

      logger.log({
        event: "openai.response",
        requestId: input.requestId,
        conversationId: prepared.conversationId,
        provider: aiProvider.name,
        replyLength: fullReply.length,
        durationMs: Date.now() - openaiStart,
      });
      await recordAiCallEvent({
        userId: input.context.userId,
        outcome: "success",
        durationMs: Date.now() - openaiStart,
        inputLength,
        replyLength: fullReply.length,
      });

      // Ver `detect-image-generation-request.ts` -- después del texto completo,
      // nunca antes ni en paralelo con él: el stream de texto ya le llegó a la
      // persona a su ritmo normal, esto solo puede sumarle latencia al final,
      // nunca restarle nada a la respuesta que ya recibió.
      const imageData = prepared.imageRequestPrompt
        ? await tryGenerateImage(aiProvider, prepared.imageRequestPrompt, {
            userId: input.context.userId,
            requestId: input.requestId,
            conversationId: prepared.conversationId,
          })
        : undefined;
      resolveImageReady(imageData);

      const { backgroundTasks } = await finalizeReply({
        context: input.context,
        lifeGraphContext: input.lifeGraphContext,
        conversationId: prepared.conversationId,
        isNewConversation: prepared.isNewConversation,
        userMessage: input.message,
        requestId: input.requestId,
        startedAt,
        reply: fullReply,
        imageData,
        capturedMemory: prepared.capturedMemory,
        conversationSignal: prepared.conversationSignal,
        seenPromptToMark: prepared.seenPromptToMark,
        route: input.route,
        firstTokenMs: firstChunkAt ? firstChunkAt - startedAt : undefined,
      });
      resolveBackgroundTasks(backgroundTasks);
    } catch (error) {
      // Red de seguridad: si el stream falla antes de llegar a
      // `finalizeReply` (error de IA, de `finalizeReply` mismo, etc.),
      // `backgroundTasksReady` igual debe resolver — si no, el `after()`
      // que el llamador registra en `app/api/chat/route.ts` queda
      // esperando para siempre (hasta `maxDuration`). El error real ya
      // se relanza tal cual: `pull()` en la ruta lo captura y registra.
      // Mismo criterio para `imageReady` -- nunca debe quedar sin resolver.
      resolveBackgroundTasks([]);
      resolveImageReady(undefined);
      throw error;
    }
  }

  return {
    conversationId: prepared.conversationId,
    textStream: generate(),
    backgroundTasksReady,
    imageReady,
  };
}
