import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getUserContext } from "@/auth/user-context";
import { createRequestId, logger } from "@/core/observability/logger";
import { buildGmailRedirectUri, getGoogleOAuthCredentials, GMAIL_OAUTH_SCOPE, GMAIL_STATE_COOKIE } from "../shared";

const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60;

/**
 * Inicia el flujo de conexión de Gmail -- acción explícita de la
 * persona (un botón en `/gmail`), nunca parte del login (ver
 * `../shared.ts`). `state` es un nonce aleatorio guardado en una cookie
 * `httpOnly` antes de redirigir a Google; `callback/route.ts` lo
 * compara contra el `state` que Google devuelve, mismo patrón estándar
 * de protección CSRF para flujos OAuth de redirección.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const route = "GET /api/gmail/connect";

  const userContext = await getUserContext();
  if (!userContext) {
    logger.log({ event: "auth.rejected", severity: "warn", requestId, route });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const credentials = getGoogleOAuthCredentials();
  if (!credentials) {
    logger.log({ event: "gmail.connect.no_oauth_client", severity: "error", requestId, route, userId: userContext.userId });
    return NextResponse.json({ error: "Conexión con Google no configurada." }, { status: 500 });
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

  logger.log({ event: "gmail.connect.redirected", requestId, route, userId: userContext.userId });

  return response;
}
