import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import { getConversationDetail } from "@/features/conversations/services/get-conversation-detail";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";

const conversationIdSchema = z.string().uuid();

/**
 * Detalle de una conversación específica, para clientes (Sprint de
 * conversaciones persistentes) — la contraparte de API de
 * `app/conversations/[id]/page.tsx`, que ya usa `getConversationDetail`
 * directamente por ser un Server Component. `app/chat/page.tsx` es un
 * Client Component: necesita un endpoint real para pedir una
 * conversación que no sea la más reciente.
 *
 * Misma forma de respuesta que `GET /api/chat`
 * (`GetLatestConversationResponse`) a propósito — el cliente reutiliza
 * la misma lógica de carga de historial sin importar cuál de las dos
 * rutas la sirvió.
 *
 * Mismo criterio de autorización que la página: `getConversationDetail`
 * devuelve `null` tanto si el id no existe como si es de otro usuario
 * — en ambos casos 404, sin distinguir el motivo. Un `id` sin forma de
 * UUID también cae en 404 antes de tocar la base de datos.
 *
 * Deliberadamente fuera del matcher de `proxy.ts` (igual que
 * `/api/health`) — la autorización real vive aquí, en el propio
 * `getUserContext()` + el filtro por `userId` de `getConversationDetail`,
 * no en el proxy.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const route = "GET /api/conversations/[id]";

  const context = await getUserContext();

  if (!context) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const parsedId = conversationIdSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json(
      { error: "Conversación no encontrada." },
      { status: 404 },
    );
  }

  try {
    const conversation = await getConversationDetail(db, context, parsedId.data);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversación no encontrada." },
        { status: 404 },
      );
    }

    logger.log({
      event: "api.request_completed",
      requestId,
      route,
      userId: context.userId,
      conversationId: conversation.id,
      status: 200,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      conversationId: conversation.id,
      messages: conversation.messages,
    });
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
