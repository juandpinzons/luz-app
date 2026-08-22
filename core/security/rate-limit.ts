import { createHash } from "node:crypto";
import { and, count, eq, gte, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { rateLimitEvents } from "../db/schema/rate-limit-events";

/**
 * Rate limiting genérico previo a la sesión (Auditoría de seguridad,
 * 2026-08-21) -- mismo patrón de `features/chat/services/check-rate-limit.ts`
 * (reserva-antes-de-trabajar, advisory lock de Postgres serializado por
 * clave, así funciona también entre instancias serverless), generalizado
 * para endpoints de login que corren SIN `userId` todavía
 * (`apple-auth/callback`, `mobile-auth/*`) -- ahí la única clave real
 * disponible es la IP de origen.
 */

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/** Nunca se guarda la IP en texto plano -- ver docblock de `rate-limit-events.ts`. */
export function hashRateLimitKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Vercel (y cualquier proxy estándar) entrega la IP real del cliente en
 * `x-forwarded-for` (primer valor de la lista -- los siguientes son
 * proxies intermedios, no el cliente). `"unknown"` como fallback nunca
 * bloquea la request: sin IP identificable, todas comparten el mismo
 * cupo generoso en vez de fallar cerrado.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function reserveRateLimitAttempt(
  db: Database,
  input: { key: string; route: string; windowMs: number; maxAttempts: number },
): Promise<RateLimitResult> {
  const hashedKey = hashRateLimitKey(input.key);
  const windowStart = new Date(Date.now() - input.windowMs);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${hashedKey}))`);

    const [result] = await tx
      .select({ value: count() })
      .from(rateLimitEvents)
      .where(
        and(
          eq(rateLimitEvents.key, hashedKey),
          gte(rateLimitEvents.createdAt, windowStart),
        ),
      );

    if ((result?.value ?? 0) >= input.maxAttempts) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(input.windowMs / 1000),
      };
    }

    await tx.insert(rateLimitEvents).values({ key: hashedKey, route: input.route });

    return { allowed: true };
  });
}
