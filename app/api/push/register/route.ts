import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import { registerDevicePushToken } from "@/core/push-notifications/repository";
import { DEVICE_PUSH_PLATFORMS, PUSH_ENVIRONMENTS } from "@/core/push-notifications/domain";
import { createRequestId, logger } from "@/core/observability/logger";

const bodySchema = z.object({
  deviceToken: z.string().min(1),
  platform: z.enum(DEVICE_PUSH_PLATFORMS),
  environment: z.enum(PUSH_ENVIRONMENTS),
});

/**
 * Registra (o reemplaza) el token de push de este dispositivo. Se
 * llama tras el login nativo y en cada arranque en frío -- Apple puede
 * rotar el token en silencio, así que "ya lo registré una vez" nunca
 * es suficiente garantía.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const route = "POST /api/push/register";

  const userContext = await getUserContext();
  if (!userContext) {
    logger.log({ event: "auth.rejected", severity: "warn", requestId, route });
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  await registerDevicePushToken(
    db,
    userContext.userId,
    parsed.data.deviceToken,
    parsed.data.platform,
    parsed.data.environment,
  );

  logger.log({ event: "push.register.succeeded", requestId, route, userId: userContext.userId });

  return NextResponse.json({ ok: true });
}
