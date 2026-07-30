import { NextResponse } from "next/server";
import { z } from "zod";
import { getLifeGraphContext, getUserContext } from "@/auth/user-context";
import { saveCalendarConnection } from "@/core/calendar-connections/repository";
import { db } from "@/core/db/client";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";
import { connectCalendar } from "@/features/reality/application";
import { AppleCalendarClient, AppleCalendarProvider } from "@/features/reality/providers/apple";

const connectRequestSchema = z.object({
  appleId: z.string().trim().min(3, "Ingresa tu Apple ID."),
  appSpecificPassword: z.string().trim().min(1, "Ingresa la contraseña específica de app."),
});

/**
 * Controlador delgado, mismo patrón que `app/api/feedback/route.ts`:
 * resuelve identidad, valida la petición, delega en Calendar
 * Foundation (`connectCalendar` -- valida las credenciales llamando
 * `provider.listCalendars()` de verdad, nunca en silencio) y en
 * `core/calendar-connections/repository.ts` para persistir. Esta ruta
 * es la ÚNICA que ve `appSpecificPassword` en texto plano, y solo de
 * paso: nunca se loguea, nunca se guarda sin cifrar (ver
 * `core/security/secret-cipher.ts`).
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const route = "POST /api/calendar/connect";

  const userContext = await getUserContext();
  if (!userContext) {
    logger.log({ event: "auth.rejected", severity: "warn", requestId, route });
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body: unknown = await request.json();
  const parsed = connectRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Solicitud inválida." },
      { status: 400 },
    );
  }

  const lifeGraphContext = await getLifeGraphContext();
  if (!lifeGraphContext) {
    logger.log({ event: "calendar.connect.no_life_graph", severity: "error", requestId, route, userId: userContext.userId });
    return NextResponse.json({ error: "No se pudo resolver tu perfil. Intenta de nuevo." }, { status: 500 });
  }

  const { appleId, appSpecificPassword } = parsed.data;
  const provider = new AppleCalendarProvider(new AppleCalendarClient({ appleId, appSpecificPassword }));

  try {
    // Valida de verdad contra iCloud (provider.listCalendars()) -- credenciales inválidas fallan aquí, nunca en el primer sync.
    await connectCalendar(provider, { lifeGraphId: lifeGraphContext.lifeGraphId, externalAccountId: appleId });

    await saveCalendarConnection(db, lifeGraphContext.lifeGraphId, "apple", appleId, {
      appleId,
      appSpecificPassword,
    });

    logger.log({
      event: "calendar.connect.succeeded",
      requestId,
      route,
      userId: userContext.userId,
      lifeGraphId: lifeGraphContext.lifeGraphId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const detail = describeError(error);
    logger.log({
      event: "calendar.connect.failed",
      severity: "error",
      requestId,
      route,
      userId: userContext.userId,
      lifeGraphId: lifeGraphContext.lifeGraphId,
      ...detail,
    });
    await recordEvent(db, {
      type: "error",
      userId: userContext.userId,
      route,
      message: error instanceof Error ? error.message : String(error),
      metadata: { lifeGraphId: lifeGraphContext.lifeGraphId, errorName: detail.errorName, errorCode: detail.errorCode },
    });

    return NextResponse.json(
      { error: "No se pudo conectar con Apple Calendar. Revisa tu Apple ID y la contraseña específica de app." },
      { status: 400 },
    );
  }
}
