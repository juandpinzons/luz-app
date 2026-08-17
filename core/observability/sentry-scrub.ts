import type { ErrorEvent, EventHint } from "@sentry/nextjs";

/**
 * `beforeSend` compartido por los 3 configs de Sentry (client/server/edge)
 * -- auditoría de privacidad, 2026-08-17. Antes de esto, los 3 confiaban
 * en los defaults del SDK para qué se captura; esto los hace explícitos
 * en vez de implícitos:
 *
 * - Cookies y headers de la request: nunca a Sentry -- pueden traer el
 *   token de sesión (`sessions.session_token`, `auth/schema.ts`).
 * - IP del usuario: fuera, aunque `sendDefaultPii` ya esté en `false`
 *   (defensa en profundidad, no confiar solo en la config global).
 * - `user`: se reduce a `id` únicamente -- nunca email/nombre, aunque
 *   el SDK los hubiera adjuntado.
 */
export function scrubSentryEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
  }

  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : {};
  }

  return event;
}
