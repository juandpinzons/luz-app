import { NextResponse } from "next/server";
import { getLifeGraphContext, getUserContext } from "@/auth/user-context";
import { saveEmailConnection } from "@/core/email-connections/repository";
import { db } from "@/core/db/client";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";
import { connectGmail } from "@/features/reality/application";
import { GmailClient, GmailProvider, type GmailCredentials } from "@/features/reality/providers/gmail";
import { buildGmailRedirectUri, getGoogleOAuthCredentials, GMAIL_STATE_COOKIE } from "../shared";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

function redirectWithError(request: Request, reason: string): Response {
  const url = new URL("/gmail", request.url);
  url.searchParams.set("error", reason);
  const response = NextResponse.redirect(url);
  response.cookies.delete(GMAIL_STATE_COOKIE);
  return response;
}

/**
 * Recibe el `code` de Google tras el consentimiento, lo intercambia por
 * tokens reales (RFC 6749 §4.1.3), valida la conexión de verdad
 * (`connectGmail` -- credenciales inválidas fallan aquí, nunca en
 * silencio en el primer sync) y persiste (`saveEmailConnection`,
 * cifrado -- ver `core/email-connections/repository.ts`). Única ruta
 * de todo el repo que ve un `refresh_token` de Gmail en texto plano, y
 * solo de paso.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const route = "GET /api/gmail/callback";

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
    logger.log({ event: "gmail.callback.denied", requestId, route, userId: userContext.userId, googleError });
    return redirectWithError(request, "denied");
  }

  const stateCookie = request.headers
    .get("cookie")
    ?.split("; ")
    .find((entry) => entry.startsWith(`${GMAIL_STATE_COOKIE}=`))
    ?.slice(GMAIL_STATE_COOKIE.length + 1);

  if (!code || !returnedState || !stateCookie || returnedState !== stateCookie) {
    logger.log({ event: "gmail.callback.invalid_state", severity: "warn", requestId, route, userId: userContext.userId });
    return redirectWithError(request, "invalid_state");
  }

  const oauthCredentials = getGoogleOAuthCredentials();
  if (!oauthCredentials) {
    logger.log({ event: "gmail.callback.no_oauth_client", severity: "error", requestId, route, userId: userContext.userId });
    return redirectWithError(request, "not_configured");
  }

  const lifeGraphContext = await getLifeGraphContext();
  if (!lifeGraphContext) {
    logger.log({ event: "gmail.callback.no_life_graph", severity: "error", requestId, route, userId: userContext.userId });
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
        redirect_uri: buildGmailRedirectUri(request),
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      throw new Error(`Google token endpoint devolvió ${tokenResponse.status}: ${body}`);
    }

    const tokens = (await tokenResponse.json()) as GoogleTokenResponse;

    // Sin `refresh_token`, la conexión deja de servir en cuanto expire el `access_token` (~1h) --
    // `access_type=offline`+`prompt=consent` (`connect/route.ts`) debería garantizarlo siempre, así
    // que tratarlo como error real (nunca guardar una conexión que sabemos que va a expirar sola).
    if (!tokens.refresh_token) {
      throw new Error("Google no devolvió refresh_token -- revisa que la petición de autorización use access_type=offline y prompt=consent.");
    }

    const credentials: GmailCredentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in !== undefined ? Date.now() + tokens.expires_in * 1000 : undefined,
      clientId: oauthCredentials.clientId,
      clientSecret: oauthCredentials.clientSecret,
    };

    const client = new GmailClient(credentials);
    const profile = await client.getProfile();

    const provider = new GmailProvider(client);
    // Valida de verdad contra Gmail (provider.listLabels()) -- mismo criterio que /api/calendar/connect.
    await connectGmail(provider, { lifeGraphId: lifeGraphContext.lifeGraphId, externalAccountId: profile.emailAddress });

    await saveEmailConnection(db, lifeGraphContext.lifeGraphId, "gmail", profile.emailAddress, credentials);

    logger.log({
      event: "gmail.connect.succeeded",
      requestId,
      route,
      userId: userContext.userId,
      lifeGraphId: lifeGraphContext.lifeGraphId,
    });

    const response = NextResponse.redirect(new URL("/gmail", request.url));
    response.cookies.delete(GMAIL_STATE_COOKIE);
    return response;
  } catch (error) {
    const detail = describeError(error);
    logger.log({
      event: "gmail.connect.failed",
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
