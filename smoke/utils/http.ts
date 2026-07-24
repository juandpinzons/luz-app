/**
 * Alias estable de producción (Vercel, apunta siempre al último deploy
 * de `main`) -- usado solo para reconocerlo y avisar fuerte si alguien
 * termina apuntando ahí, nunca como default.
 */
export const PRODUCTION_BASE_URL = "https://luz-app-joinluz.vercel.app";

/**
 * Default seguro: local. `npm run smoke` nunca toca producción por
 * accidente -- eso requiere `npm run smoke:prod` (usa `.env.smoke`,
 * que fija `SMOKE_BASE_URL` explícitamente a producción). Requiere
 * `npm run dev` corriendo en otra terminal cuando se usa el default.
 */
const DEFAULT_BASE_URL = "http://localhost:3000";

export function smokeBaseUrl(): string {
  return process.env.SMOKE_BASE_URL ?? DEFAULT_BASE_URL;
}

export function isProductionTarget(): boolean {
  return smokeBaseUrl().replace(/\/$/, "") === PRODUCTION_BASE_URL;
}

export interface SmokeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/** `fetch` con la cookie de sesión de smoke test ya puesta. */
export function smokeFetch(
  path: string,
  sessionCookie: string,
  options: SmokeFetchOptions = {},
): Promise<Response> {
  return fetch(`${smokeBaseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Cookie: sessionCookie,
      ...options.headers,
    },
    body: options.body,
  });
}
