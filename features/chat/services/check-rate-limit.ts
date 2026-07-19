import { and, count, eq, gte } from "drizzle-orm";
import { db } from "../../../core/db/client";
import { events } from "../../../core/db/schema";

/**
 * Ventana y límite (P1-2/P1-5, ALPHA_BACKLOG.md): sin límite, cualquier
 * cuenta autenticada (o comprometida) puede generar gasto ilimitado de
 * OpenAI. 20 mensajes/5 min es generoso para uso humano real (el
 * pilotaje actual no se acerca a eso) pero corta un loop automatizado o
 * un abuso rápidamente. Ajustable sin migración — vive solo aquí.
 */
const WINDOW_MS = 5 * 60 * 1000;
const MAX_MESSAGES_PER_WINDOW = 20;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Cuenta eventos `message_sent` reales del usuario en la ventana
 * (tabla `events`, ya poblada por cada mensaje enviado — sin tabla ni
 * librería nueva). Determinista, sin estado en memoria: funciona igual
 * en cualquier instancia serverless, a diferencia de un contador local.
 */
export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const [result] = await db
    .select({ value: count() })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        eq(events.type, "message_sent"),
        gte(events.createdAt, windowStart),
      ),
    );

  const sentInWindow = result?.value ?? 0;

  if (sentInWindow < MAX_MESSAGES_PER_WINDOW) {
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil(WINDOW_MS / 1000),
  };
}
