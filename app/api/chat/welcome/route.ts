import { NextResponse } from "next/server";
import { getLifeGraphContext, getUserContext } from "@/auth/user-context";
import {
  countTotalMessages,
  generateWelcome,
  getLastMessageAt,
} from "@/features/chat/services/generate-welcome";
import type { WelcomeSignature } from "@/features/chat/services/generate-welcome";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";
import { db } from "@/core/db/client";

export type GetWelcomeResponse = WelcomeSignature;

/**
 * Se pide una sola vez, al llegar a una conversación nueva y vacía
 * (nunca al reanudar una conversación existente vía `conversationId` --
 * ahí `historicalLabel` ya da el contexto). Controlador delgado, mismo
 * patrón que el resto de `app/api/chat/*`: solo identidad + delegación.
 */
export async function GET(): Promise<Response> {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const route = "GET /api/chat/welcome";

  const context = await getUserContext();
  if (!context) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  let lifeGraphContext;
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

  if (!lifeGraphContext) {
    // Sin LifeGraph no hay `RealitySnapshot` que ensamblar -- la
    // bienvenida cae a algo simple pero real, nunca a un error visible
    // (el chat en sí nunca depende de esto, mismo criterio que el
    // resto de la integración de LifeGraph).
    return NextResponse.json({
      cue: "Aquí estoy",
      greeting: "Cuéntame lo que quieras, sin apuro.",
      orb: { maturityStage: "spark", warmth: 0.25, rhythmMs: 4200, anticipation: false },
    } satisfies GetWelcomeResponse);
  }

  try {
    const [totalMessageCount, lastMessageAt] = await Promise.all([
      countTotalMessages(db, context.userId),
      getLastMessageAt(db, context.userId),
    ]);

    const welcome = await generateWelcome(db, lifeGraphContext, {
      isFirstEverConversation: totalMessageCount === 0,
      msSinceLastMessage: lastMessageAt ? Date.now() - lastMessageAt.getTime() : null,
      totalMessageCount,
    });

    logger.log({
      event: "api.request_completed",
      requestId,
      route,
      userId: context.userId,
      status: 200,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(welcome satisfies GetWelcomeResponse);
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

    return NextResponse.json({
      cue: "Aquí estoy",
      greeting: "Cuéntame lo que quieras, sin apuro.",
      orb: { maturityStage: "spark", warmth: 0.25, rhythmMs: 4200, anticipation: false },
    } satisfies GetWelcomeResponse);
  }
}
