import { NextResponse } from "next/server";
import { getLifeGraphContext, getUserContext } from "@/auth/user-context";
import { checkRateLimit } from "@/features/chat/services/check-rate-limit";
import { getLatestConversation } from "@/features/chat/services/get-latest-conversation";
import { sendMessage } from "@/features/chat/services/send-message";
import { sendMessageRequestSchema } from "@/features/chat/types";
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

  try {
    const result = await sendMessage({
      context,
      lifeGraphContext,
      conversationId: parsed.data.conversationId,
      message: parsed.data.message,
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
    await recordEvent(db, {
      type: "error",
      userId: context.userId,
      route,
      message,
    });

    return NextResponse.json(
      { error: "No se pudo procesar el mensaje. Intenta de nuevo en unos segundos." },
      { status: 500 },
    );
  }
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
