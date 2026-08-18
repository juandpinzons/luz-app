/**
 * Compartido entre `start/route.ts` y `callback/route.ts` -- mismo
 * patrón exacto que `app/api/gmail/shared.ts`, con dos diferencias
 * deliberadas (ver cada ruta): este flujo NO exige sesión previa (es
 * el login primario, no una conexión secundaria) y pide `access_type:
 * "online"` (nunca necesita volver a llamar a Google en nombre de la
 * persona después del login, a diferencia de Gmail/YouTube).
 */

export { getGoogleOAuthCredentials, type GoogleOAuthCredentials } from "@/core/config/google-oauth-credentials";

/** `openid email profile` -- el scope estándar de Auth.js para el proveedor Google (`auth/providers/index.ts` no lo sobreescribe), nunca un scope incremental. */
export const MOBILE_AUTH_OAUTH_SCOPE = "openid email profile";

export const MOBILE_AUTH_STATE_COOKIE = "mobile_auth_state";

/**
 * `redirect_uri` debe ser IDÉNTICO byte a byte entre `start` y
 * `callback`, y estar registrado como URI de redirección autorizada en
 * el cliente OAuth de Google Cloud Console -- dependencia externa del
 * Founder, ver el plan de la misión.
 */
export function buildMobileAuthRedirectUri(request: Request): string {
  return new URL("/api/mobile-auth/callback", request.url).toString();
}
