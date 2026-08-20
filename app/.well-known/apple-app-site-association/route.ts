import { NextResponse } from "next/server";

/**
 * Habilita Universal Links para el shell nativo iOS -- misión "shell
 * nativo iOS", 2026-08-19. Sin esto, `/mobile/bridge?exchange_code=...`
 * (el regreso del login nativo de Google, ver
 * `app/api/mobile-auth/callback/route.ts`) siempre cae en el navegador
 * de sistema en vez de que iOS lo entregue directo a la app -- la
 * página de respaldo en `app/mobile/bridge/page.tsx` existe
 * precisamente para ese caso.
 *
 * Debe servirse en `/.well-known/apple-app-site-association`, sin
 * extensión, por HTTPS, sin redirects, `Content-Type: application/json`
 * -- Route Handler en vez de un archivo estático en `public/` a
 * propósito: `next/server`'s static file serving no garantiza el
 * Content-Type correcto para un archivo sin extensión (typeo del
 * navegador → `application/octet-stream`, Apple exige `application/json`).
 *
 * `appID` = `<TEAM_ID>.<BUNDLE_ID>` -- `3LHXN6YFNN` es el Team ID real
 * de la cuenta de Apple Developer Program del Founder (pública una vez
 * la app se publique, no es secreta), `com.joinluz.app` es el mismo
 * Bundle ID de siempre (`native/capacitor.config.ts`,
 * `core/apple-auth/verify-identity-token.ts`).
 *
 * `paths` acotado a `/mobile/bridge*` a propósito -- lo único que hoy
 * necesita abrir la app en vez de Safari. Ampliar esto (compartir un
 * link de conversación, etc.) es una decisión de producto aparte, no
 * algo que este archivo deba asumir de antemano.
 */
const APPLE_APP_SITE_ASSOCIATION = {
  applinks: {
    apps: [] as string[],
    details: [
      {
        appID: "3LHXN6YFNN.com.joinluz.app",
        paths: ["/mobile/bridge*"],
      },
    ],
  },
};

export async function GET(): Promise<Response> {
  return NextResponse.json(APPLE_APP_SITE_ASSOCIATION);
}
