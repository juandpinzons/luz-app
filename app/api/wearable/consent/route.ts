import { NextResponse } from "next/server";
import { z } from "zod";
import { getLifeGraphContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import { recordWearableConsent } from "@/core/wearable-metrics/consent";
import { WEARABLE_PROVIDER_KINDS } from "@/core/wearable-metrics/domain";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";

const bodySchema = z.object({ provider: z.enum(WEARABLE_PROVIDER_KINDS) });

/**
 * Registra consentimiento real antes del flujo manual de wearable
 * (auditoría de privacidad, 2026-08-17) -- ver docblock de
 * `wearableConsents` (`core/db/schema/wearable.ts`). Este endpoint no
 * envía ni importa nada; solo dice "esta persona vio la explicación y
 * aceptó antes de escribirnos". `.scratch/import-garmin-export.ts`
 * ahora exige que esta fila exista antes de importar.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const route = "POST /api/wearable/consent";

  const context = await getLifeGraphContext();
  if (!context) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Proveedor inválido." }, { status: 400 });
  }

  try {
    await recordWearableConsent(db, context.lifeGraphId, parsed.data.provider);

    await recordEvent(db, {
      type: "wearable_consent_given",
      route,
      metadata: { provider: parsed.data.provider },
    });

    logger.log({
      event: "api.request_completed",
      requestId,
      route,
      status: 200,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.log({
      event: "api.request_failed",
      severity: "error",
      requestId,
      route,
      status: 500,
      durationMs: Date.now() - startedAt,
      error: message,
    });

    return NextResponse.json({ error: "No se pudo registrar el consentimiento." }, { status: 500 });
  }
}
