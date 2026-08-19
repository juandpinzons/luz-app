import { NextResponse } from "next/server";
import { linkNativeAccountAndCreateSession } from "@/auth/link-native-account-and-create-session";
import { db } from "@/core/db/client";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";
import { buildMobileAuthRedirectUri, getGoogleOAuthCredentials, MOBILE_AUTH_STATE_COOKIE } from "../shared";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
/** Perfil verificado por Google mismo -- evita tener que verificar la firma del id_token contra el JWKS rotativo de Google a mano; mismo dato que el proveedor Google de Auth.js termina resolviendo internamente. */
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
/** Auditoría 2026-08-19: ninguna de las dos llamadas a Google de abajo tenía límite de tiempo -- mismo hallazgo que `core/apple-auth/verify-identity-token.ts`, mismo arreglo (`AbortSignal.timeout` cancela de verdad, a diferencia del `withTimeout` de los crons). Sin esto, un Google lento dejaba a alguien real esperando en el botón de login sin límite. */
const GOOGLE_FETCH_TIMEOUT_MS = 10_000;

interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

interface GoogleUserinfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

function redirectWithError(request: Request, reason: string): Response {
  const url = new URL("/mobile/bridge", request.url);
  url.searchParams.set("error", reason);
  const response = NextResponse.redirect(url);
  response.cookies.delete(MOBILE_AUTH_STATE_COOKIE);
  return response;
}

/**
 * Recibe el `code` de Google tras el consentimiento -- corre en el
 * navegador de sistema, nunca en la WebView propia de la app (ver
 * `../start/route.ts`). A diferencia de `/api/auth/callback/google`
 * (el catch-all de Auth.js), esta ruta NO exige sesión previa: es el
 * login primario en sí.
 *
 * La creación/vinculación de la cuenta y la sesión en sí viven en
 * `linkNativeAccountAndCreateSession` (`auth/link-native-account-and-create-session.ts`),
 * compartida con `app/api/apple-auth/callback/route.ts` -- esta ruta
 * solo sabe cómo verificar la identidad CON GOOGLE (intercambio de
 * código + userinfo), nunca cómo crear la sesión.
 *
 * El `sessionToken` real NUNCA sale de este servidor hacia el
 * dispositivo -- se guarda vía `createMobileSessionHandoff` y solo un
 * código de intercambio opaco, de un solo uso, viaja en la URL de
 * regreso (`/mobile/bridge`, un Universal Link que iOS intercepta
 * antes de que el navegador de sistema siquiera la renderice). Ver
 * `auth/schema.ts::mobileSessionHandoffs` para el porqué completo de
 * este puente.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const route = "GET /api/mobile-auth/callback";

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");

  if (googleError) {
    logger.log({ event: "mobile_auth.callback.denied", requestId, route, googleError });
    return redirectWithError(request, "denied");
  }

  const stateCookie = request.headers
    .get("cookie")
    ?.split("; ")
    .find((entry) => entry.startsWith(`${MOBILE_AUTH_STATE_COOKIE}=`))
    ?.slice(MOBILE_AUTH_STATE_COOKIE.length + 1);

  if (!code || !returnedState || !stateCookie || returnedState !== stateCookie) {
    logger.log({ event: "mobile_auth.callback.invalid_state", severity: "warn", requestId, route });
    return redirectWithError(request, "invalid_state");
  }

  const oauthCredentials = getGoogleOAuthCredentials();
  if (!oauthCredentials) {
    logger.log({ event: "mobile_auth.callback.no_oauth_client", severity: "error", requestId, route });
    return redirectWithError(request, "not_configured");
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
        redirect_uri: buildMobileAuthRedirectUri(request),
      }).toString(),
      signal: AbortSignal.timeout(GOOGLE_FETCH_TIMEOUT_MS),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      throw new Error(`Google token endpoint devolvió ${tokenResponse.status}: ${body}`);
    }

    const tokens = (await tokenResponse.json()) as GoogleTokenResponse;

    const userinfoResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(GOOGLE_FETCH_TIMEOUT_MS),
    });
    if (!userinfoResponse.ok) {
      throw new Error(`Google userinfo endpoint devolvió ${userinfoResponse.status}.`);
    }
    const profile = (await userinfoResponse.json()) as GoogleUserinfo;

    if (!profile.email) {
      throw new Error("Google no devolvió un email para esta cuenta.");
    }

    const { exchangeCode, userId, isNewUser } = await linkNativeAccountAndCreateSession(db, {
      provider: "google",
      providerAccountId: profile.sub,
      email: profile.email,
      emailVerified: Boolean(profile.email_verified),
      name: profile.name ?? null,
      image: profile.picture ?? null,
      accountFields: {
        access_token: tokens.access_token,
        id_token: tokens.id_token,
        // `AdapterAccount.token_type` exige minúsculas (OAuth 2.0 RFC
        // 6749 §5.1 lo permite en cualquier capitalización, pero Auth.js
        // lo tipa estricto) -- Google devuelve "Bearer" con mayúscula.
        token_type: tokens.token_type?.toLowerCase() as Lowercase<string> | undefined,
        scope: tokens.scope,
        expires_at:
          tokens.expires_in !== undefined ? Math.floor(Date.now() / 1000) + tokens.expires_in : undefined,
      },
    });

    logger.log({
      event: "mobile_auth.callback.succeeded",
      requestId,
      route,
      userId,
      isNewUser,
    });

    const bridgeUrl = new URL("/mobile/bridge", request.url);
    bridgeUrl.searchParams.set("exchange_code", exchangeCode);
    const response = NextResponse.redirect(bridgeUrl);
    response.cookies.delete(MOBILE_AUTH_STATE_COOKIE);
    return response;
  } catch (error) {
    const detail = describeError(error);
    logger.log({ event: "mobile_auth.callback.failed", severity: "error", requestId, route, ...detail });
    await recordEvent(db, {
      type: "error",
      route,
      message: error instanceof Error ? error.message : String(error),
      metadata: { errorName: detail.errorName, errorCode: detail.errorCode },
    });
    return redirectWithError(request, "connect_failed");
  }
}
