import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "./core/observability/sentry-scrub";

/**
 * Sin `NEXT_PUBLIC_SENTRY_DSN` el SDK no lanza -- queda inerte,
 * mismo criterio de degradación silenciosa que `getCalendarSignalsForConversation`.
 * Permite mergear esto antes de que el DSN real esté configurado en Vercel.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Bajo a propósito -- Alpha/Beta, tráfico real todavía pequeño, y el
  // tier gratis de Sentry mide "performance units" por separado de
  // errores (10k/mes). Prioridad es capturar errores, no trazas.
  tracesSampleRate: 0.1,
  // Explícito, no el default implícito del SDK (auditoría de
  // privacidad, 2026-08-17) -- cookies/headers de request (pueden
  // traer session_token) y PII más allá del id de usuario, scrubbed.
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
  // Nunca en producción -- solo ayuda a depurar el propio setup del SDK.
  debug: false,
});
