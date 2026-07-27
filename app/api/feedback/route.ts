import { NextResponse } from "next/server";
import { getUserContext } from "@/auth/user-context";
import { submitFeedback } from "@/features/feedback/services/submit-feedback";
import { submitFeedbackRequestSchema } from "@/features/feedback/types";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";
import { db } from "@/core/db/client";

/**
 * Controlador delgado, mismo patrón que `app/api/chat/route.ts`: solo
 * resuelve identidad, valida la petición y delega en `features/feedback`.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const route = "POST /api/feedback";

  const context = await getUserContext();

  if (!context) {
    logger.log({ event: "auth.rejected", severity: "warn", requestId, route });
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body: unknown = await request.json();
  const parsed = submitFeedbackRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Solicitud inválida." },
      { status: 400 },
    );
  }

  try {
    const result = await submitFeedback(context, parsed.data);

    logger.log({
      event: "api.request_completed",
      requestId,
      route,
      userId: context.userId,
      status: 200,
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
      error: message,
    });
    await recordEvent(db, {
      type: "error",
      userId: context.userId,
      route,
      message,
    });

    return NextResponse.json(
      { error: "No se pudo guardar tu feedback. Intenta de nuevo en unos segundos." },
      { status: 500 },
    );
  }
}
