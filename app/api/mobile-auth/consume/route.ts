import { NextResponse } from "next/server";
import { consumeMobileSessionHandoff } from "@/auth/mobile-session-handoff-repository";
import { db } from "@/core/db/client";
import { createRequestId, logger } from "@/core/observability/logger";

/** Mismo default que Auth.js (`@auth/core/lib/init.js`) -- ver `callback/route.ts` para el porqué de replicarlo en vez de importarlo. */
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * El paso final del puente de login nativo -- la WebView PROPIA de la
 * app navega aquí de verdad (una navegación real, nunca un `fetch` en
 * segundo plano: solo una navegación de página persiste un
 * `Set-Cookie` en el cookie jar del WebView). Consume el código de
 * intercambio de un solo uso (`app/api/mobile-auth/callback/route.ts`,
 * vía `app/mobile/bridge/page.tsx` como Universal Link) y planta la
 * cookie real de sesión -- mismo nombre/atributos que Auth.js ya
 * infiere para el request entrante
 * (`node_modules/@auth/core/lib/utils/cookie.js::defaultCookies`,
 * `node_modules/@auth/core/lib/init.js`: `useSecureCookies =
 * url.protocol === "https:"` cuando no se sobreescribe, y este proyecto
 * nunca lo sobreescribe). De aquí en adelante, `proxy.ts`/`auth()`/
 * `getUserContext()` no necesitan ningún cambio -- ven una sesión de
 * base de datos idéntica a una de login web.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const route = "GET /api/mobile-auth/consume";

  const url = new URL(request.url);
  const exchangeCode = url.searchParams.get("exchange_code");

  if (!exchangeCode) {
    logger.log({ event: "mobile_auth.consume.missing_code", severity: "warn", requestId, route });
    return NextResponse.redirect(new URL("/login?error=mobile_auth_failed", request.url));
  }

  const sessionToken = await consumeMobileSessionHandoff(db, exchangeCode);

  if (!sessionToken) {
    logger.log({ event: "mobile_auth.consume.invalid_code", severity: "warn", requestId, route });
    return NextResponse.redirect(new URL("/login?error=mobile_auth_expired", request.url));
  }

  logger.log({ event: "mobile_auth.consume.succeeded", requestId, route });

  const useSecureCookies = url.protocol === "https:";
  const cookieName = `${useSecureCookies ? "__Secure-" : ""}authjs.session-token`;

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: useSecureCookies,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
