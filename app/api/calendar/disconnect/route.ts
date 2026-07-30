import { NextResponse } from "next/server";
import { getLifeGraphContext, getUserContext } from "@/auth/user-context";
import { disconnectStoredCalendarConnection } from "@/core/calendar-connections/repository";
import { db } from "@/core/db/client";
import { createRequestId, logger } from "@/core/observability/logger";

/**
 * Transición de estado pura del lado de LUZ -- conserva la fila (mismo
 * criterio que `disconnectCalendar`, `features/reality/application/`),
 * nunca borra la credencial cifrada de la base de datos aquí; eso
 * seguiría siendo responsabilidad de un flujo de borrado de cuenta
 * aparte, no de esta ruta.
 */
export async function POST(): Promise<Response> {
  const requestId = createRequestId();
  const route = "POST /api/calendar/disconnect";

  const userContext = await getUserContext();
  if (!userContext) {
    logger.log({ event: "auth.rejected", severity: "warn", requestId, route });
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const lifeGraphContext = await getLifeGraphContext();
  if (!lifeGraphContext) {
    return NextResponse.json({ error: "No se pudo resolver tu perfil." }, { status: 500 });
  }

  await disconnectStoredCalendarConnection(db, lifeGraphContext.lifeGraphId, "apple");

  logger.log({
    event: "calendar.disconnect.succeeded",
    requestId,
    route,
    userId: userContext.userId,
    lifeGraphId: lifeGraphContext.lifeGraphId,
  });

  return NextResponse.json({ ok: true });
}
