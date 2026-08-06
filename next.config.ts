import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Headers de seguridad (Sprint de seguridad, Alpha, 2026-07-19,
 * SEC-1 en docs/engineering/ALPHA_BACKLOG.md). Deliberadamente
 * conservador: solo headers sin riesgo real de romper algo en
 * producción (sin dependencias en scripts inline, sin tocar el flujo
 * de OAuth de Google). Una Content-Security-Policy estricta queda
 * fuera a propósito — requiere probarse con cuidado contra el login
 * real antes de desplegarse, no se improvisa en el mismo cambio.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

/**
 * Sentry (2026-08-06, ver docs/engineering/BETA_DEVELOPMENT_ROADMAP_V1.md
 * §6 Prioridad 2) -- envuelve el config solo para el paso de build
 * (sourcemaps legibles en Sentry, tree-shaking de código de debug).
 * `org`/`project`/`authToken` ausentes: el build sigue funcionando
 * igual, solo sin subir sourcemaps -- Sentry ya captura errores sin
 * esto, es una mejora aparte, no un bloqueo.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  // `disableLogger`/`automaticVercelMonitors` deliberadamente fuera --
  // este proyecto compila con Turbopack (`next dev`/`next build`
  // default), y el propio SDK marca ambas opciones "not supported with
  // Turbopack" en 10.69.0. Config muerta, no un recorte de features.
  widenClientFileUpload: false,
});
