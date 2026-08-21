import { NextResponse } from "next/server";
import { getUserContext } from "@/auth/user-context";
import { createAccountIdentityResolver } from "@/auth/drizzle-identity-resolver";
import { saveEmailConnection } from "@/core/email-connections/repository";
import { db } from "@/core/db/client";
import type { EntityId } from "@/core/life/value-objects/entity-id";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";
import { connectGmail } from "@/features/reality/application";
import { GmailClient, GmailProvider, type GmailCredentials } from "@/features/reality/providers/gmail";
import { buildGmailRedirectUri, getGoogleOAuthCredentials, GMAIL_NATIVE_USER_COOKIE, GMAIL_STATE_COOKIE } from "../shared";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

function readCookie(request: Request, name: string): string | undefined {
  return request.headers
    .get("cookie")
    ?.split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/**
 * Camino web: de vuelta a `/gmail` con `?error=`. Camino nativo: de
 * vuelta a `/mobile/bridge` -- el único path que Universal Links
 * intercepta hoy (`app/.well-known/apple-app-site-association`), la
 * app misma decide qué hacer con `purpose=gmail_connect`/`status=error`
 * (ver el listener nuevo en `connect-gmail-button.tsx`).
 */
function redirectWithError(request: Request, isNative: boolean, reason: string): Response {
  const url = isNative ? new URL("/mobile/bridge", request.url) : new URL("/gmail", request.url);
  if (isNative) {
    url.searchParams.set("purpose", "gmail_connect");
    url.searchParams.set("status", "error");
    url.searchParams.set("reason", reason);
  } else {
    url.searchParams.set("error", reason);
  }
  const response = NextResponse.redirect(url);
  response.cookies.delete(GMAIL_STATE_COOKIE);
  if (isNative) response.cookies.delete(GMAIL_NATIVE_USER_COOKIE);
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
 *
 * Camino nativo (shell iOS): `GMAIL_NATIVE_USER_COOKIE` (plantada por
 * `connect/route.ts` cuando resolvió un `exchangeCode`) reemplaza a
 * `getUserContext()` -- este request corre en el navegador de sistema,
 * sin la cookie de sesión de Auth.js. `createAccountIdentityResolver`
 * en vez de `getLifeGraphContext()` por el mismo motivo: esa función
 * también depende de la sesión actual internamente
 * (`auth/user-context.ts`), aquí ya se resolvió el `userId` sin ella.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const route = "GET /api/gmail/callback";

  const nativeUserId = readCookie(request, GMAIL_NATIVE_USER_COOKIE);
  const isNative = Boolean(nativeUserId);

  let userId: string;
  if (nativeUserId) {
    userId = nativeUserId;
  } else {
    const userContext = await getUserContext();
    if (!userContext) {
      logger.log({ event: "auth.rejected", severity: "warn", requestId, route });
      return NextResponse.redirect(new URL("/login", request.url));
    }
    userId = userContext.userId;
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");

  if (googleError) {
    logger.log({ event: "gmail.callback.denied", requestId, route, userId, googleError });
    return redirectWithError(request, isNative, "denied");
  }

  const stateCookie = readCookie(request, GMAIL_STATE_COOKIE);

  if (!code || !returnedState || !stateCookie || returnedState !== stateCookie) {
    logger.log({ event: "gmail.callback.invalid_state", severity: "warn", requestId, route, userId });
    return redirectWithError(request, isNative, "invalid_state");
  }

  const oauthCredentials = getGoogleOAuthCredentials();
  if (!oauthCredentials) {
    logger.log({ event: "gmail.callback.no_oauth_client", severity: "error", requestId, route, userId });
    return redirectWithError(request, isNative, "not_configured");
  }

  let lifeGraphId: EntityId;
  try {
    lifeGraphId = (await createAccountIdentityResolver(db).resolve(userId)).lifeGraphId;
  } catch (error) {
    logger.log({
      event: "gmail.callback.no_life_graph",
      severity: "error",
      requestId,
      route,
      userId,
      ...describeError(error),
    });
    return redirectWithError(request, isNative, "no_profile");
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
    await connectGmail(provider, { lifeGraphId, externalAccountId: profile.emailAddress });

    await saveEmailConnection(db, lifeGraphId, "gmail", profile.emailAddress, credentials);

    logger.log({
      event: "gmail.connect.succeeded",
      requestId,
      route,
      userId,
      lifeGraphId,
      native: isNative,
    });

    const successUrl = isNative ? new URL("/mobile/bridge", request.url) : new URL("/gmail", request.url);
    if (isNative) {
      successUrl.searchParams.set("purpose", "gmail_connect");
      successUrl.searchParams.set("status", "success");
    }
    const response = NextResponse.redirect(successUrl);
    response.cookies.delete(GMAIL_STATE_COOKIE);
    if (isNative) response.cookies.delete(GMAIL_NATIVE_USER_COOKIE);
    return response;
  } catch (error) {
    const detail = describeError(error);
    logger.log({
      event: "gmail.connect.failed",
      severity: "error",
      requestId,
      route,
      userId,
      lifeGraphId,
      ...detail,
    });
    await recordEvent(db, {
      type: "error",
      userId,
      route,
      message: error instanceof Error ? error.message : String(error),
      metadata: { lifeGraphId, errorName: detail.errorName, errorCode: detail.errorCode },
    });

    return redirectWithError(request, isNative, "connect_failed");
  }
}
