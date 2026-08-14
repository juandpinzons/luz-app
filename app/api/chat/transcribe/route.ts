import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getUserContext } from "@/auth/user-context";
import { env } from "@/core/config/env";
import { db } from "@/core/db/client";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, logger } from "@/core/observability/logger";
import { reserveRateLimitSlot } from "@/features/chat/services/check-rate-limit";

export const maxDuration = 30;

const ROUTE = "POST /api/chat/transcribe";
/** El botón de micrófono ya limita la grabación a ~2 min del lado del cliente -- esto es defensa en profundidad, nunca la única barrera. */
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

/**
 * Transcribe una nota de voz para poblar el input del chat -- nunca se
 * envía como mensaje por su cuenta, la persona sigue revisando el texto
 * antes de "Enviar" (mismo criterio que escribir a mano). Comparte el
 * mismo cupo de `reserveRateLimitSlot` que enviar un mensaje real
 * (P1-2/P1-5) a propósito: transcribir es el mismo costo real de IA que
 * este límite ya existe para controlar, no un camino aparte para
 * esquivarlo.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId();

  const userContext = await getUserContext();
  if (!userContext) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const rateLimit = await reserveRateLimitSlot(db, { userId: userContext.userId, route: ROUTE });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Muchos mensajes seguidos -- espera un momento." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const formData = await request.formData().catch(() => null);
  const audio = formData?.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Falta el audio." }, { status: 400 });
  }
  if (audio.size === 0) {
    return NextResponse.json({ error: "La grabación quedó vacía. Intenta de nuevo." }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "La grabación es muy larga." }, { status: 413 });
  }

  try {
    const transcription = await client.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      // Pista, no restricción -- LUZ es una app en español, pero Whisper
      // sigue transcribiendo bien si la persona habla en otro idioma.
      language: "es",
    });

    logger.log({
      event: "chat.transcribe.succeeded",
      requestId,
      route: ROUTE,
      userId: userContext.userId,
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    logger.log({
      event: "chat.transcribe.failed",
      severity: "error",
      requestId,
      route: ROUTE,
      userId: userContext.userId,
      ...describeError(error),
    });

    return NextResponse.json({ error: "No se pudo transcribir el audio. Intenta de nuevo." }, { status: 500 });
  }
}
