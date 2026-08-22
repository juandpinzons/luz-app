import { env } from "../config/env";

/**
 * Cloudflare Turnstile (Auditoría de seguridad, 2026-08-21) -- scaffold
 * listo para conectar en cuanto exista `TURNSTILE_SECRET_KEY` (server)
 * y `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (cliente, widget). Ninguna ruta lo
 * llama todavía -- el site key/secret los genera el Founder en
 * dash.cloudflare.com/turnstile, no algo que este código pueda crear
 * por sí solo. Candidatos naturales una vez existan las keys: cualquier
 * endpoint público sin sesión que reciba texto libre de un desconocido
 * (encuestas, feedback anónimo).
 *
 * `configured: false` es un resultado explícito, nunca un `true`
 * silencioso -- un llamador debe decidir a propósito qué hacer sin
 * Turnstire configurado (normalmente: no bloquear, solo no verificar
 * todavía), nunca asumir que "no configurado" implica "seguro".
 */

const SITEVERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const FETCH_TIMEOUT_MS = 5_000;

export type TurnstileVerification =
  | { configured: false }
  | { configured: true; success: true }
  | { configured: true; success: false; errorCodes: string[] };

interface SiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string,
): Promise<TurnstileVerification> {
  if (!env.TURNSTILE_SECRET_KEY) {
    return { configured: false };
  }

  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetch(SITEVERIFY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    return { configured: true, success: false, errorCodes: [`http_${response.status}`] };
  }

  const result = (await response.json()) as SiteverifyResponse;
  if (result.success) {
    return { configured: true, success: true };
  }
  return { configured: true, success: false, errorCodes: result["error-codes"] ?? [] };
}
