import { NextResponse } from "next/server";
import { getLifeGraphContext, getUserContext } from "@/auth/user-context";
import { disconnectStoredEmailConnection } from "@/core/email-connections/repository";
import { db } from "@/core/db/client";
import { createRequestId, logger } from "@/core/observability/logger";

/**
 * Transición de estado pura del lado de LUZ -- conserva la fila (mismo
 * criterio que `disconnectGmail`, `features/reality/application/`),
 * nunca borra la credencial cifrada de la base de datos aquí. Mismo
 * patrón exacto que `/api/calendar/disconnect`.
 */
export async function POST(): Promise<Response> {
  const requestId = createRequestId();
  const route = "POST /api/gmail/disconnect";

  const userContext = await getUserContext();
  if (!userContext) {
    logger.log({ event: "auth.rejected", severity: "warn", requestId, route });
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const lifeGraphContext = await getLifeGraphContext();
  if (!lifeGraphContext) {
    return NextResponse.json({ error: "No se pudo resolver tu perfil." }, { status: 500 });
  }

  await disconnectStoredEmailConnection(db, lifeGraphContext.lifeGraphId, "gmail");

  logger.log({
    event: "gmail.disconnect.succeeded",
    requestId,
    route,
    userId: userContext.userId,
    lifeGraphId: lifeGraphContext.lifeGraphId,
  });

  return NextResponse.json({ ok: true });
}
