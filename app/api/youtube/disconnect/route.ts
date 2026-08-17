import { NextResponse } from "next/server";
import { getLifeGraphContext, getUserContext } from "@/auth/user-context";
import { disconnectStoredYoutubeConnection } from "@/core/youtube-connections/repository";
import { db } from "@/core/db/client";
import { createRequestId, logger } from "@/core/observability/logger";

/**
 * Transición de estado pura del lado de LUZ -- mismo patrón exacto que
 * `app/api/gmail/disconnect/route.ts`.
 */
export async function POST(): Promise<Response> {
  const requestId = createRequestId();
  const route = "POST /api/youtube/disconnect";

  const userContext = await getUserContext();
  if (!userContext) {
    logger.log({ event: "auth.rejected", severity: "warn", requestId, route });
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const lifeGraphContext = await getLifeGraphContext();
  if (!lifeGraphContext) {
    return NextResponse.json({ error: "No se pudo resolver tu perfil." }, { status: 500 });
  }

  await disconnectStoredYoutubeConnection(db, lifeGraphContext.lifeGraphId, "youtube");

  logger.log({
    event: "youtube.disconnect.succeeded",
    requestId,
    route,
    userId: userContext.userId,
    lifeGraphId: lifeGraphContext.lifeGraphId,
  });

  return NextResponse.json({ ok: true });
}
