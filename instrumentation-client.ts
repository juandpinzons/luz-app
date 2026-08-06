import * as Sentry from "@sentry/nextjs";

/** Mismo criterio que `sentry.server.config.ts` -- inerte sin DSN. */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Session Replay apagado a propósito -- graba interacciones reales de
  // pantalla; activarlo es una decisión de privacidad aparte, no algo
  // que este setup base deba encender por defecto.
  debug: false,
});

/** Requerido por el SDK para instrumentar navegaciones entre rutas (App Router). */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
