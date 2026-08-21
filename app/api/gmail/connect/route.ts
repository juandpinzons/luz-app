import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getUserContext } from "@/auth/user-context";
import { consumeGmailConnectHandoff } from "@/core/email-connections/gmail-connect-handoff";
import { db } from "@/core/db/client";
import { createRequestId, logger } from "@/core/observability/logger";
import {
  buildGmailRedirectUri,
  getGoogleOAuthCredentials,
  GMAIL_NATIVE_USER_COOKIE,
  GMAIL_OAUTH_SCOPE,
  GMAIL_STATE_COOKIE,
} from "../shared";

const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60;

function redirectToNativeBridgeWithError(request: Request, reason: string): Response {
  const url = new URL("/mobile/bridge", request.url);
  url.searchParams.set("purpose", "gmail_connect");
  url.searchParams.set("status", "error");
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

/**
 * Inicia el flujo de conexión de Gmail -- acción explícita de la
 * persona (un botón en `/gmail`), nunca parte del login (ver
 * `../shared.ts`). `state` es un nonce aleatorio guardado en una cookie
 * `httpOnly` antes de redirigir a Google; `callback/route.ts` lo
 * compara contra el `state` que Google devuelve, mismo patrón estándar
 * de protección CSRF para flujos OAuth de redirección.
 *
 * Camino nativo (shell iOS, misión "shell nativo iOS"): si llega
 * `?exchangeCode=` (emitido por `/api/gmail/native/start`, dentro de la
 * WebView propia de la app, justo antes de `Browser.open()`), resuelve
 * el `userId` desde ahí en vez de `getUserContext()` -- este request
 * corre en el navegador de sistema, que no comparte cookie jar con la
 * WebView y por lo tanto no tiene la cookie de sesión de Auth.js (ver
 * docblock de `GMAIL_NATIVE_USER_COOKIE` en `../shared.ts`). Sin
 * `exchangeCode`, comportamiento web exactamente igual que antes.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const route = "GET /api/gmail/connect";

  const url = new URL(request.url);
  const exchangeCode = url.searchParams.get("exchangeCode");
  const isNative = Boolean(exchangeCode);

  let userId: string;

  if (exchangeCode) {
    const resolvedUserId = await consumeGmailConnectHandoff(db, exchangeCode);
    if (!resolvedUserId) {
      logger.log({ event: "gmail.connect.invalid_exchange_code", severity: "warn", requestId, route });
      return redirectToNativeBridgeWithError(request, "invalid_state");
    }
    userId = resolvedUserId;
  } else {
    const userContext = await getUserContext();
    if (!userContext) {
      logger.log({ event: "auth.rejected", severity: "warn", requestId, route });
      return NextResponse.redirect(new URL("/login", request.url));
    }
    userId = userContext.userId;
  }

  const credentials = getGoogleOAuthCredentials();
  if (!credentials) {
    logger.log({ event: "gmail.connect.no_oauth_client", severity: "error", requestId, route, userId });
    return isNative
      ? redirectToNativeBridgeWithError(request, "not_configured")
      : NextResponse.json({ error: "Conexión con Google no configurada." }, { status: 500 });
  }

  const state = randomBytes(32).toString("base64url");

  const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  authorizationUrl.searchParams.set("client_id", credentials.clientId);
  authorizationUrl.searchParams.set("redirect_uri", buildGmailRedirectUri(request));
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", GMAIL_OAUTH_SCOPE);
  // `access_type=offline` + `prompt=consent`: sin esto, Google solo devuelve `refresh_token` la
  // primera vez que la persona autoriza esta app -- forzar consentimiento cada vez garantiza que
  // `callback/route.ts` siempre reciba uno, incluso si la persona reconecta después de revocar el
  // acceso desde su cuenta de Google.
  authorizationUrl.searchParams.set("access_type", "offline");
  authorizationUrl.searchParams.set("prompt", "consent");
  authorizationUrl.searchParams.set("include_granted_scopes", "true");
  authorizationUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(GMAIL_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/api/gmail",
  });

  if (isNative) {
    response.cookies.set(GMAIL_NATIVE_USER_COOKIE, userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
      path: "/api/gmail",
    });
  }

  logger.log({ event: "gmail.connect.redirected", requestId, route, userId, native: isNative });

  return response;
}
