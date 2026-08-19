/**
 * Carrera contra un límite de tiempo -- nunca cancela la promesa
 * original (sin `AbortController` plomeado hasta los clientes HTTP;
 * `gmail-client.ts`/`apple-calendar-client.ts` no le pasan `signal` a
 * `fetch`, así que no hay nada que abortar de verdad todavía), solo
 * deja de esperarla y devuelve `null`. Pensado para llamadas externas
 * sin timeout propio, usadas dentro de un cron con presupuesto de
 * tiempo COMPARTIDO entre muchas personas (`app/api/cron/continuity-worker/route.ts`,
 * `app/api/cron/calendar-reminder-worker/route.ts`) -- sin esto, una
 * sola cuenta con un proveedor lento o colgado podría consumir el
 * `maxDuration` completo de la función serverless, y Vercel mataría la
 * ejecución a mitad de lote sin procesar a nadie más.
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeoutHandle: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => {
    timeoutHandle = setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutHandle!);
  }
}
