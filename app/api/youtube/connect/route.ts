import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getUserContext } from "@/auth/user-context";
import { createRequestId, logger } from "@/core/observability/logger";
import { buildYoutubeRedirectUri, getGoogleOAuthCredentials, YOUTUBE_OAUTH_SCOPE, YOUTUBE_STATE_COOKIE } from "../shared";

const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60;

/**
 * Inicia el flujo de conexión de YouTube -- mismo patrón exacto que
 * `app/api/gmail/connect/route.ts`.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const route = "GET /api/youtube/connect";

  const userContext = await getUserContext();
  if (!userContext) {
    logger.log({ event: "auth.rejected", severity: "warn", requestId, route });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const credentials = getGoogleOAuthCredentials();
  if (!credentials) {
    logger.log({ event: "youtube.connect.no_oauth_client", severity: "error", requestId, route, userId: userContext.userId });
    return NextResponse.json({ error: "Conexión con Google no configurada." }, { status: 500 });
  }

  const state = randomBytes(32).toString("base64url");

  const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  authorizationUrl.searchParams.set("client_id", credentials.clientId);
  authorizationUrl.searchParams.set("redirect_uri", buildYoutubeRedirectUri(request));
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", YOUTUBE_OAUTH_SCOPE);
  authorizationUrl.searchParams.set("access_type", "offline");
  authorizationUrl.searchParams.set("prompt", "consent");
  authorizationUrl.searchParams.set("include_granted_scopes", "true");
  authorizationUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(YOUTUBE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/api/youtube",
  });

  logger.log({ event: "youtube.connect.redirected", requestId, route, userId: userContext.userId });

  return response;
}
