/**
 * Extraído de `app/api/cron/knowledge-worker/route.ts` (auditoría de
 * seguridad, 2026-08-14) para que `/api/cron/health-check` use
 * exactamente el mismo criterio -- nunca una segunda copia que pueda
 * desincronizarse. `CRON_SECRET` es una variable real de Vercel (no un
 * secreto hardcodeado en el código, el error que motivó esta
 * auditoría): Vercel la adjunta sola como `Authorization: Bearer
 * <secret>` en cada invocación programada real.
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}
