const DEFAULT_BASE_URL = "https://luz-app-joinluz.vercel.app";

/**
 * URL estable de producción (alias de Vercel apuntando siempre al
 * último deploy de `main`) -- overridable con `SMOKE_BASE_URL` para
 * correr la suite contra otro entorno mientras se desarrolla.
 */
export function smokeBaseUrl(): string {
  return process.env.SMOKE_BASE_URL ?? DEFAULT_BASE_URL;
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
