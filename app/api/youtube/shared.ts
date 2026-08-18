/**
 * Compartido entre `connect/route.ts` y `callback/route.ts` -- mismo
 * patrón exacto que `app/api/gmail/shared.ts`.
 *
 * Reutiliza el cliente OAuth de Google YA configurado para login
 * (`auth/providers/index.ts`, `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`) --
 * scope incremental pedido en un flujo SEPARADO del login, nunca
 * agregado al consentimiento que todos ven al iniciar sesión.
 *
 * **Dependencia externa real, fuera del alcance de este código**: el
 * scope `youtube.readonly` (a diferencia de `gmail.metadata`, que ya
 * estaba habilitado en el cliente OAuth existente) es un scope
 * "sensible" de Google -- para que el consentimiento funcione con
 * cuentas reales fuera de la lista de "test users" del proyecto en
 * Google Cloud Console, este scope necesita agregarse a la pantalla de
 * consentimiento OAuth del proyecto (y, dependiendo del estado de
 * publicación de la app, puede requerir el proceso de verificación de
 * Google). Esto no es algo que este código pueda resolver -- requiere
 * acceso al proyecto en Google Cloud Console.
 */

export { getGoogleOAuthCredentials, type GoogleOAuthCredentials } from "@/core/config/google-oauth-credentials";

/** El scope de lectura más angosto que ofrece YouTube Data API v3 -- permite leer videos/canales de la cuenta, nunca escribir (dar like, suscribirse, subir) ni leer comentarios/mensajes privados. */
export const YOUTUBE_OAUTH_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

export const YOUTUBE_STATE_COOKIE = "youtube_oauth_state";

/** Mismo criterio exacto que `buildGmailRedirectUri` -- debe ser IDÉNTICO byte a byte entre `connect` y `callback`, y estar registrado como URI de redirección autorizada en el cliente OAuth de Google Cloud Console. */
export function buildYoutubeRedirectUri(request: Request): string {
  return new URL("/api/youtube/callback", request.url).toString();
}
