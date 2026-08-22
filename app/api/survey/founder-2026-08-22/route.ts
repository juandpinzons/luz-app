import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";
import { FOUNDER_SURVEY_CONCEPTS, FOUNDER_SURVEY_ID } from "@/features/survey/founder-survey-2026-08-22";

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  concepts: z.array(z.enum(FOUNDER_SURVEY_CONCEPTS)).max(FOUNDER_SURVEY_CONCEPTS.length),
});

/**
 * Encuesta puntual del Founder, un solo día (sábado 22 de agosto de
 * 2026) -- ver `features/survey/founder-survey-2026-08-22.ts` para el
 * porqué de las constantes hardcodeadas. `concepts` puede venir vacío
 * (persona respondió solo la calificación) -- ninguna de las dos
 * preguntas fuerza una respuesta completa más allá de la calificación
 * misma.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const route = "POST /api/survey/founder-2026-08-22";

  const userContext = await getUserContext();
  if (!userContext) {
    logger.log({ event: "auth.rejected", severity: "warn", requestId, route });
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  await recordEvent(db, {
    type: "survey_response",
    userId: userContext.userId,
    metadata: {
      surveyId: FOUNDER_SURVEY_ID,
      rating: parsed.data.rating,
      concepts: parsed.data.concepts,
    },
  });

  logger.log({ event: "survey.founder_2026_08_22.responded", requestId, route, userId: userContext.userId });

  return NextResponse.json({ ok: true });
}
