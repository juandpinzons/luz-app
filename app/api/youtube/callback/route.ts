import { NextResponse } from "next/server";
import { getLifeGraphContext, getUserContext } from "@/auth/user-context";
import { saveYoutubeConnection } from "@/core/youtube-connections/repository";
import { db } from "@/core/db/client";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";
import { connectYoutube } from "@/features/reality/application";
import { YoutubeClient, YoutubeProvider, type YoutubeCredentials } from "@/features/reality/providers/youtube";
import { buildYoutubeRedirectUri, getGoogleOAuthCredentials, YOUTUBE_STATE_COOKIE } from "../shared";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

function redirectWithError(request: Request, reason: string): Response {
  const url = new URL("/youtube", request.url);
  url.searchParams.set("error", reason);
  const response = NextResponse.redirect(url);
  response.cookies.delete(YOUTUBE_STATE_COOKIE);
  return response;
}

/**
 * Recibe el `code` de Google tras el consentimiento -- mismo patrón
 * exacto que `app/api/gmail/callback/route.ts`.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const route = "GET /api/youtube/callback";

  const userContext = await getUserContext();
  if (!userContext) {
    logger.log({ event: "auth.rejected", severity: "warn", requestId, route });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");

  if (googleError) {
    logger.log({ event: "youtube.callback.denied", requestId, route, userId: userContext.userId, googleError });
    return redirectWithError(request, "denied");
  }

  const stateCookie = request.headers
    .get("cookie")
    ?.split("; ")
    .find((entry) => entry.startsWith(`${YOUTUBE_STATE_COOKIE}=`))
    ?.slice(YOUTUBE_STATE_COOKIE.length + 1);

  if (!code || !returnedState || !stateCookie || returnedState !== stateCookie) {
    logger.log({ event: "youtube.callback.invalid_state", severity: "warn", requestId, route, userId: userContext.userId });
    return redirectWithError(request, "invalid_state");
  }

  const oauthCredentials = getGoogleOAuthCredentials();
  if (!oauthCredentials) {
    logger.log({ event: "youtube.callback.no_oauth_client", severity: "error", requestId, route, userId: userContext.userId });
    return redirectWithError(request, "not_configured");
  }

  const lifeGraphContext = await getLifeGraphContext();
  if (!lifeGraphContext) {
    logger.log({ event: "youtube.callback.no_life_graph", severity: "error", requestId, route, userId: userContext.userId });
    return redirectWithError(request, "no_profile");
  }

  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: oauthCredentials.clientId,
        client_secret: oauthCredentials.clientSecret,
        redirect_uri: buildYoutubeRedirectUri(request),
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      throw new Error(`Google token endpoint devolvió ${tokenResponse.status}: ${body}`);
    }

    const tokens = (await tokenResponse.json()) as GoogleTokenResponse;

    if (!tokens.refresh_token) {
      throw new Error("Google no devolvió refresh_token -- revisa que la petición de autorización use access_type=offline y prompt=consent.");
    }

    const credentials: YoutubeCredentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in !== undefined ? Date.now() + tokens.expires_in * 1000 : undefined,
      clientId: oauthCredentials.clientId,
      clientSecret: oauthCredentials.clientSecret,
    };

    const client = new YoutubeClient(credentials);
    const channel = await client.getChannel();

    const provider = new YoutubeProvider(client);
    // Valida de verdad contra YouTube (provider.getChannel() -- ya se llamó arriba, pero connectYoutube repite la llamada de validación oficial del caso de uso, mismo criterio que connectGmail/provider.listLabels()).
    await connectYoutube(provider, { lifeGraphId: lifeGraphContext.lifeGraphId, externalAccountId: channel.id });

    await saveYoutubeConnection(db, lifeGraphContext.lifeGraphId, "youtube", channel.id, credentials);

    logger.log({
      event: "youtube.connect.succeeded",
      requestId,
      route,
      userId: userContext.userId,
      lifeGraphId: lifeGraphContext.lifeGraphId,
    });

    const response = NextResponse.redirect(new URL("/youtube", request.url));
    response.cookies.delete(YOUTUBE_STATE_COOKIE);
    return response;
  } catch (error) {
    const detail = describeError(error);
    logger.log({
      event: "youtube.connect.failed",
      severity: "error",
      requestId,
      route,
      userId: userContext.userId,
      lifeGraphId: lifeGraphContext.lifeGraphId,
      ...detail,
    });
    await recordEvent(db, {
      type: "error",
      userId: userContext.userId,
      route,
      message: error instanceof Error ? error.message : String(error),
      metadata: { lifeGraphId: lifeGraphContext.lifeGraphId, errorName: detail.errorName, errorCode: detail.errorCode },
    });

    return redirectWithError(request, "connect_failed");
  }
}
