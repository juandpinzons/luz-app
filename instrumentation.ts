import * as Sentry from "@sentry/nextjs";

/**
 * Convención de Next.js (`register()`, ver node_modules/next/dist/docs/.../instrumentation.mdx)
 * -- despacha por runtime porque el edge runtime no soporta el SDK de
 * Node completo. Añadido 2026-08-06: hasta ahora, la única visibilidad
 * de errores en producción era la tabla `events` y `/admin` -- nadie
 * se entera de una falla real salvo que la busque a mano.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
