import { NextResponse } from "next/server";
import { authConfig } from "@/auth/config";
import { createMobileSessionHandoff } from "@/auth/mobile-session-handoff-repository";
import { db } from "@/core/db/client";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";
import { buildMobileAuthRedirectUri, getGoogleOAuthCredentials, MOBILE_AUTH_STATE_COOKIE } from "../shared";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
/** Perfil verificado por Google mismo -- evita tener que verificar la firma del id_token contra el JWKS rotativo de Google a mano; mismo dato que el proveedor Google de Auth.js termina resolviendo internamente. */
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
/** Mismo default que Auth.js (`@auth/core/lib/init.js`, `session.maxAge`) -- 30 días, nunca un número inventado aparte para que una sesión nativa no expire distinto que una web. */
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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
 * Usa DIRECTAMENTE la misma instancia de `Adapter` que construye
 * `auth/config.ts` (mismo `DrizzleAdapter` envuelto en
 * `withEncryptedAccountTokens`) para crear/vincular el usuario y crear
 * la sesión -- nunca reimplementa esa lógica aparte. La sesión
 * resultante es indistinguible de un login web normal: misma tabla
 * `sessions`, mismos tokens cifrados en `accounts` (`linkAccount` ya
 * los cifra, ver `auth/encrypted-adapter.ts`), mismo evento
 * `auth_sign_in` que `authConfig.events.signIn` dispara para el login
 * web (se dispara a mano aquí porque este camino nunca pasa por el
 * ciclo de vida interno de Auth.js).
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

  // Defensivo, nunca debería pasar -- auth/config.ts siempre construye
  // el adapter. Explícito en vez de asumirlo en silencio, mismo
  // criterio que el resto de esta ruta.
  const adapter = authConfig.adapter;
  if (!adapter?.getUserByAccount || !adapter.getUserByEmail || !adapter.createUser || !adapter.linkAccount || !adapter.createSession) {
    logger.log({ event: "mobile_auth.callback.no_adapter", severity: "error", requestId, route });
    return redirectWithError(request, "connect_failed");
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
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      throw new Error(`Google token endpoint devolvió ${tokenResponse.status}: ${body}`);
    }

    const tokens = (await tokenResponse.json()) as GoogleTokenResponse;

    const userinfoResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userinfoResponse.ok) {
      throw new Error(`Google userinfo endpoint devolvió ${userinfoResponse.status}.`);
    }
    const profile = (await userinfoResponse.json()) as GoogleUserinfo;

    if (!profile.email) {
      throw new Error("Google no devolvió un email para esta cuenta.");
    }

    // Mismo orden de resolución que el ciclo interno de Auth.js: primero
    // por la cuenta ya vinculada, después por email (una persona que ya
    // existe pero todavía no tiene esta cuenta de Google vinculada --
    // no debería pasar en un proyecto con un solo proveedor, pero se
    // maneja explícito en vez de asumirlo imposible), y solo si ninguna
    // existe, una persona nueva.
    let user = await adapter.getUserByAccount({ provider: "google", providerAccountId: profile.sub });
    let isNewUser = false;

    if (!user) {
      const existingByEmail = await adapter.getUserByEmail(profile.email);

      if (existingByEmail) {
        user = existingByEmail;
      } else {
        // `id` se descarta en tiempo de ejecución cuando la tabla ya
        // tiene default (`users.id`, `defaultRandom()`) -- ver
        // `node_modules/@auth/drizzle-adapter/lib/pg.js`. Se pasa solo
        // para satisfacer el tipo `AdapterUser`, nunca se usa de verdad.
        user = await adapter.createUser({
          id: crypto.randomUUID(),
          email: profile.email,
          emailVerified: profile.email_verified ? new Date() : null,
          name: profile.name ?? null,
          image: profile.picture ?? null,
        });
        isNewUser = true;
      }

      await adapter.linkAccount({
        userId: user.id,
        type: "oauth",
        provider: "google",
        providerAccountId: profile.sub,
        access_token: tokens.access_token,
        id_token: tokens.id_token,
        // `AdapterAccount.token_type` exige minúsculas (OAuth 2.0 RFC
        // 6749 §5.1 lo permite en cualquier capitalización, pero Auth.js
        // lo tipa estricto) -- Google devuelve "Bearer" con mayúscula.
        token_type: tokens.token_type?.toLowerCase() as Lowercase<string> | undefined,
        scope: tokens.scope,
        expires_at:
          tokens.expires_in !== undefined ? Math.floor(Date.now() / 1000) + tokens.expires_in : undefined,
      });
    }

    const session = await adapter.createSession({
      sessionToken: crypto.randomUUID(),
      userId: user.id,
      expires: new Date(Date.now() + SESSION_MAX_AGE_MS),
    });

    await recordEvent(db, {
      type: "auth_sign_in",
      userId: user.id,
      metadata: { isNewUser, via: "mobile" },
    });

    const exchangeCode = await createMobileSessionHandoff(db, session.sessionToken);

    logger.log({
      event: "mobile_auth.callback.succeeded",
      requestId,
      route,
      userId: user.id,
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
