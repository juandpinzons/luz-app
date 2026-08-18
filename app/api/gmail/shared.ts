/**
 * Compartido entre `connect/route.ts` y `callback/route.ts` -- nunca
 * una ruta en sí (sin `GET`/`POST` exportado, Next.js no lo trata como
 * tal, mismo criterio que `app/calendar/disconnect-button.tsx` vive
 * dentro de `app/` sin ser una ruta).
 *
 * Reutiliza el cliente OAuth de Google YA configurado para login
 * (`auth/providers/index.ts`, `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`) --
 * scope incremental pedido en un flujo SEPARADO del login, nunca
 * agregado al consentimiento que todos ven al iniciar sesión (ver
 * `features/reality/README.md`, "Gmail Foundation", Puntos de
 * extensión #3).
 */

export { getGoogleOAuthCredentials, type GoogleOAuthCredentials } from "@/core/config/google-oauth-credentials";

/** `gmail.metadata`, no `gmail.readonly` -- el scope más angosto que Google ofrece, ni siquiera permite pedir el cuerpo de un mensaje (ver `features/reality/providers/gmail/gmail-client.ts`). */
export const GMAIL_OAUTH_SCOPE = "https://www.googleapis.com/auth/gmail.metadata";

export const GMAIL_STATE_COOKIE = "gmail_oauth_state";

/**
 * `redirect_uri` debe ser IDÉNTICO byte a byte entre la petición de
 * autorización (`connect/route.ts`) y el intercambio de código
 * (`callback/route.ts`) -- construido desde el origen real de la
 * petición entrante (`localhost:3000` en dev, el dominio real en
 * producción) para que ambos ambientes funcionen sin una variable de
 * entorno nueva. Requiere que este path esté registrado como URI de
 * redirección autorizada en el cliente OAuth de Google Cloud Console
 * -- dependencia externa, ver PR.
 */
export function buildGmailRedirectUri(request: Request): string {
  return new URL("/api/gmail/callback", request.url).toString();
}
