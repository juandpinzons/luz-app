import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import { deleteDevicePushToken } from "@/core/push-notifications/repository";
import { createRequestId, logger } from "@/core/observability/logger";

const bodySchema = z.object({ deviceToken: z.string().min(1) });

/**
 * Borra el token de este dispositivo -- a diferencia de las conexiones
 * OAuth (Gmail/Calendar/YouTube), esto SÍ borra la fila de verdad, ver
 * docblock de `devicePushTokens` en `core/db/schema/push-notifications.ts`.
 * Se llama en logout.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const route = "POST /api/push/unregister";

  const userContext = await getUserContext();
  if (!userContext) {
    logger.log({ event: "auth.rejected", severity: "warn", requestId, route });
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  await deleteDevicePushToken(db, userContext.userId, parsed.data.deviceToken);

  logger.log({ event: "push.unregister.succeeded", requestId, route, userId: userContext.userId });

  return NextResponse.json({ ok: true });
}
