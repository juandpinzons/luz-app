/**
 * Extraído de `app/api/gmail/shared.ts` (estaba duplicado byte a byte
 * en `app/api/youtube/shared.ts`) -- misión "shell nativo iOS",
 * 2026-08-18: con `app/api/mobile-auth/` sumando un tercer consumidor,
 * mantener esto como copy-paste habría significado tres lugares para
 * actualizar si alguna vez cambia cómo se leen estas credenciales.
 *
 * Deliberadamente lee `process.env` directo, no pasa por
 * `core/config/env.ts` -- mismo criterio que ya regía en los dos
 * archivos originales: `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` son la
 * convención propia de Auth.js (`AUTH_<PROVIDER>_ID`/`_SECRET`,
 * ver `auth/providers/index.ts`), consumida también por
 * `next-auth/providers/google` directamente -- nunca pasan por el
 * esquema Zod validado del dominio.
 */
export interface GoogleOAuthCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

/** `null` si el proyecto no tiene el proveedor Google configurado -- no debería pasar en un ambiente donde el login con Google ya funciona, pero ningún llamador debe asumirlo silenciosamente. */
export function getGoogleOAuthCredentials(): GoogleOAuthCredentials | null {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
