import { NextResponse } from "next/server";
import { getLifeGraphContext, getUserContext } from "@/auth/user-context";
import { checkRateLimit } from "@/features/chat/services/check-rate-limit";
import { getLatestConversation } from "@/features/chat/services/get-latest-conversation";
import {
  sendMessage,
  sendMessageStream,
} from "@/features/chat/services/send-message";
import { sendMessageRequestSchema } from "@/features/chat/types";
import type { UserContext } from "@/core/identity/user-context";
import type { LifeGraphContext } from "@/core/life/life-graph-context";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";
import { db } from "@/core/db/client";

/**
 * Respuestas reales medidas en producción llegan hasta ~22s (mensajes
 * largos/complejos) — el límite por defecto de Vercel (10s) las corta a
 * mitad de camino. 60s es el máximo permitido en el plan Hobby.
 */
export const maxDuration = 60;

/**
 * Controlador delgado (decisión CTO #1 y #11): solo resuelve la
 * identidad, parsea/valida la petición y delega en `features/chat`.
 * Ninguna lógica de negocio vive aquí.
 *
 * El proxy (`proxy.ts`, antes `middleware.ts` — renombrado en Next.js
 * 16) ya bloquea esta ruta sin sesión, pero se vuelve a comprobar aquí:
 * una ruta nunca debe asumir que el proxy es la única línea de defensa.
 *
 * Desde ADR-0017, el streaming es una capacidad nueva, negociada por
 * contenido — nunca un reemplazo silencioso del contrato existente.
 * Por defecto (sin `Accept: text/event-stream`, o cualquier otro
 * valor) responde exactamente igual que siempre: JSON
 * `{conversationId, reply}` vía `sendMessage`. Solo cuando el cliente
 * pide explícitamente `Accept: text/event-stream` responde con un
 * stream real Server-Sent Events vía `sendMessageStream` — mismo
 * criterio de negociación por header que ya usa el resto de la web.
 * Todo camino de error (401/429/400/500) es JSON en ambos casos, sin
 * excepción.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const route = "POST /api/chat";

  const context = await getUserContext();

  if (!context) {
    logger.log({ event: "auth.rejected", severity: "warn", requestId, route });
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  // P1-2/P1-5 (ALPHA_BACKLOG.md): antes de cualquier trabajo real (DB,
  // LifeGraphContext, OpenAI), para que una cuenta que excede el límite
  // no siga generando costo ni carga.
  const rateLimit = await checkRateLimit(context.userId);
  if (!rateLimit.allowed) {
    logger.log({
      event: "rate_limit.rejected",
      severity: "warn",
      requestId,
      route,
      userId: context.userId,
    });
    return NextResponse.json(
      { error: "Demasiados mensajes en poco tiempo. Espera un momento e intenta de nuevo." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  // Resuelve (y bootstrapea si hace falta) el LifeGraphContext de esta
  // Account. Desde Beta 1 Sprint B1, `sendMessage` lo usa para capturar
  // Memory real — pero sigue siendo tolerante a fallos: si esto no se
  // resuelve, el chat continúa igual, solo sin captura de Memory.
  let lifeGraphContext: LifeGraphContext | null = null;
  try {
    lifeGraphContext = await getLifeGraphContext();
  } catch (error) {
    logger.log({
      event: "lifegraph.resolve_failed",
      severity: "warn",
      requestId,
      route,
      userId: context.userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const body: unknown = await request.json();
  const parsed = sendMessageRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Solicitud inválida." },
      { status: 400 },
    );
  }

  const wantsStream = (request.headers.get("Accept") ?? "").includes(
    "text/event-stream",
  );

  const shared: SharedRequestParams = {
    context,
    lifeGraphContext,
    message: parsed.data.message,
    conversationId: parsed.data.conversationId,
    requestId,
    route,
    startedAt,
  };

  return wantsStream ? handleStreamRequest(shared) : handleJsonRequest(shared);
}

interface SharedRequestParams {
  context: UserContext;
  lifeGraphContext: LifeGraphContext | null;
  message: string;
  conversationId: string | undefined;
  requestId: string;
  route: string;
  startedAt: number;
}

/** Comportamiento original de `POST /api/chat`, sin cambios desde antes de ADR-0017 — el contrato por defecto para cualquier cliente que no pida streaming explícitamente. */
async function handleJsonRequest(
  params: SharedRequestParams,
): Promise<Response> {
  const { context, lifeGraphContext, message, conversationId, requestId, route, startedAt } =
    params;

  try {
    const result = await sendMessage({
      context,
      lifeGraphContext,
      conversationId,
      message,
      requestId,
    });

    logger.log({
      event: "api.request_completed",
      requestId,
      route,
      userId: context.userId,
      conversationId: result.conversationId,
      status: 200,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.log({
      event: "api.request_failed",
      severity: "error",
      requestId,
      route,
      userId: context.userId,
      status: 500,
      durationMs: Date.now() - startedAt,
      error: errorMessage,
    });
    await recordEvent(db, {
      type: "error",
      userId: context.userId,
      route,
      message: errorMessage,
    });

    return NextResponse.json(
      { error: "No se pudo procesar el mensaje. Intenta de nuevo en unos segundos." },
      { status: 500 },
    );
  }
}

function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * ADR-0017: capacidad nueva, negociada por `Accept:
 * text/event-stream` — nunca el comportamiento por defecto. Server-Sent
 * Events real: un evento `meta` primero (con `conversationId`, conocido
 * antes de tocar la IA), luego un evento `chunk` por fragmento de
 * texto. El `data` de cada evento va como JSON — evita cualquier
 * ambigüedad si un fragmento llegara a contener un salto de línea.
 *
 * Si `sendMessageStream` falla en su fase de preparación, ese error se
 * lanza ANTES de devolver ninguna respuesta — cae en el catch y
 * responde JSON 500, igual que `handleJsonRequest`. Una vez que el
 * stream se devuelve, la respuesta ya está comprometida a 200; un
 * fallo de ahí en adelante se propaga como stream roto
 * (`controller.error`), que el cliente interpreta igual que una falla
 * de red.
 */
async function handleStreamRequest(
  params: SharedRequestParams,
): Promise<Response> {
  const { context, lifeGraphContext, message, conversationId: inputConversationId, requestId, route, startedAt } =
    params;

  let streamResult;
  try {
    streamResult = await sendMessageStream({
      context,
      lifeGraphContext,
      conversationId: inputConversationId,
      message,
      requestId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.log({
      event: "api.request_failed",
      severity: "error",
      requestId,
      route,
      userId: context.userId,
      status: 500,
      durationMs: Date.now() - startedAt,
      error: errorMessage,
    });
    await recordEvent(db, {
      type: "error",
      userId: context.userId,
      route,
      message: errorMessage,
    });

    return NextResponse.json(
      { error: "No se pudo procesar el mensaje. Intenta de nuevo en unos segundos." },
      { status: 500 },
    );
  }

  const { conversationId, textStream } = streamResult;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encoder.encode(sseMessage("meta", { conversationId })),
      );
    },
    async pull(controller) {
      try {
        const { value, done } = await textStream.next();

        if (done) {
          controller.close();
          logger.log({
            event: "api.request_completed",
            requestId,
            route,
            userId: context.userId,
            conversationId,
            status: 200,
            durationMs: Date.now() - startedAt,
          });
          return;
        }

        controller.enqueue(encoder.encode(sseMessage("chunk", value)));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.log({
          event: "api.request_failed",
          severity: "error",
          requestId,
          route,
          userId: context.userId,
          conversationId,
          status: 500,
          durationMs: Date.now() - startedAt,
          error: errorMessage,
        });
        await recordEvent(db, {
          type: "error",
          userId: context.userId,
          route,
          message: errorMessage,
        });
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

/**
 * Recupera la conversación más reciente del usuario — para que /chat
 * pueda mostrar el hilo al volver a abrirse en vez de empezar vacío
 * (el historial ya vivía en Postgres, esto solo lo expone). `null` si
 * el usuario nunca ha conversado con LUZ.
 */
export async function GET(): Promise<Response> {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const route = "GET /api/chat";

  const context = await getUserContext();

  if (!context) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    const latest = await getLatestConversation(context);
    logger.log({
      event: "api.request_completed",
      requestId,
      route,
      userId: context.userId,
      status: 200,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(latest);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.log({
      event: "api.request_failed",
      severity: "error",
      requestId,
      route,
      userId: context.userId,
      status: 500,
      durationMs: Date.now() - startedAt,
      error: message,
    });
    await recordEvent(db, { type: "error", userId: context.userId, route, message });

    return NextResponse.json(
      { error: "No se pudo recuperar la conversación." },
      { status: 500 },
    );
  }
}
