import type { NextConfig } from "next";

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

export default nextConfig;
