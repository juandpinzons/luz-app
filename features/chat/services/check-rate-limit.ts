import { and, count, eq, gte, sql } from "drizzle-orm";
import type { Database } from "../../../core/db/client";
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
 * Reserva un cupo ANTES de iniciar trabajo costoso. Contar solo
 * `message_sent` al final de la respuesta dejaba una ventana de carrera:
 * varias solicitudes concurrentes podían observar el mismo conteo y todas
 * llegar a OpenAI. La reserva y el conteo viven en la misma transacción,
 * serializada por usuario con un advisory lock de PostgreSQL; por eso el
 * límite funciona también entre instancias serverless.
 *
 * Un intento que luego falla sigue consumiendo el cupo de la ventana. Es
 * intencional: ya pudo haber usado recursos de DB/IA y no debe permitir
 * reintentos ilimitados contra una dependencia degradada.
 */
export async function reserveRateLimitSlot(
  db: Database,
  input: { userId: string; route: string },
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${input.userId}))`,
    );

    const [result] = await tx
      .select({ value: count() })
      .from(events)
      .where(
        and(
          eq(events.userId, input.userId),
          eq(events.type, "message_attempted"),
          gte(events.createdAt, windowStart),
        ),
      );

    if ((result?.value ?? 0) >= MAX_MESSAGES_PER_WINDOW) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(WINDOW_MS / 1000),
      };
    }

    await tx.insert(events).values({
      type: "message_attempted",
      userId: input.userId,
      route: input.route,
    });

    return { allowed: true };
  });
}
