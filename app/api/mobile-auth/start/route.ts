import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/core/db/client";
import { createRequestId, logger } from "@/core/observability/logger";
import { getClientIp, reserveRateLimitAttempt } from "@/core/security/rate-limit";
import {
  buildMobileAuthRedirectUri,
  getGoogleOAuthCredentials,
  MOBILE_AUTH_OAUTH_SCOPE,
  MOBILE_AUTH_STATE_COOKIE,
} from "../shared";

const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60;
/** Auditoría de seguridad, 2026-08-21 -- ver mismo comentario en apple-auth/callback/route.ts. */
const AUTH_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 20;

/**
 * Inicia el login primario nativo -- la app abre esta URL con
 * `Browser.open()` (navegador de sistema real, `ASWebAuthenticationSession`
 * por debajo en iOS), NUNCA la WebView propia de la app: Google
 * bloquea el consentimiento OAuth dentro de un WebView embebido
 * (política "disallowed_useragent"). Ver `auth/schema.ts::mobileSessionHandoffs`
 * para el resto del puente.
 *
 * A diferencia de `app/api/gmail/connect/route.ts`, esta ruta NUNCA
 * exige una sesión existente (es el login en sí, no una conexión
 * secundaria) y pide `access_type=online` sin `prompt=consent` --
 * nunca necesita un `refresh_token` (el login no vuelve a llamar a
 * Google en nombre de la persona), y sin forzar el consentimiento cada
 * vez, un regreso ya autorizado es más rápido para quien ya conectó
 * antes.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const route = "GET /api/mobile-auth/start";

  const rateLimit = await reserveRateLimitAttempt(db, {
    key: getClientIp(request),
    route,
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    maxAttempts: AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  });
  if (!rateLimit.allowed) {
    logger.log({ event: "mobile_auth.start.rate_limited", severity: "warn", requestId, route });
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta de nuevo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const credentials = getGoogleOAuthCredentials();
  if (!credentials) {
    logger.log({ event: "mobile_auth.start.no_oauth_client", severity: "error", requestId, route });
    return NextResponse.json({ error: "Conexión con Google no configurada." }, { status: 500 });
  }

  const state = randomBytes(32).toString("base64url");

  const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  authorizationUrl.searchParams.set("client_id", credentials.clientId);
  authorizationUrl.searchParams.set("redirect_uri", buildMobileAuthRedirectUri(request));
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", MOBILE_AUTH_OAUTH_SCOPE);
  authorizationUrl.searchParams.set("access_type", "online");
  authorizationUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(MOBILE_AUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/api/mobile-auth",
  });

  logger.log({ event: "mobile_auth.start.redirected", requestId, route });

  return response;
}
