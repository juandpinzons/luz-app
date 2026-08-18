import type { CapacitorConfig } from "@capacitor/cli";

/**
 * `server.url` apunta a la URL de producción EN VIVO -- misión "shell
 * nativo iOS", 2026-08-18. Decisión ya validada (ver el plan de la
 * misión): la app usa Server Actions, sesiones basadas en cookies+DB
 * (`proxy.ts`) y `headers()` en `next.config.ts`, todo lo que la
 * documentación oficial de Next.js lista como incompatible con
 * `output: 'export'` -- un build estático empaquetado no es viable sin
 * una reescritura mayor. El WKWebView de la app SIEMPRE carga lo que
 * esté desplegado ahora mismo en Vercel: un deploy normal a `main`
 * llega a la app sin pasar por revisión de Apple. Solo un cambio al
 * SHELL nativo en sí (un plugin nuevo, un permiso nuevo) exige volver a
 * someter la app.
 *
 * `appId` es un placeholder -- debe coincidir con el Bundle ID real
 * registrado en Apple Developer Program (Fase 0 del plan, acción
 * externa del Founder, todavía no hecha).
 *
 * `webDir: "www"` es obligatorio para la herramienta de Capacitor
 * aunque nunca se sirve contenido real desde ahí (ver `server.url`
 * arriba) -- Capacitor exige que exista, ver `www/.gitkeep`.
 */
const config: CapacitorConfig = {
  appId: "com.joinluz.app",
  appName: "LUZ",
  webDir: "www",
  server: {
    // TODO: cambiar al dominio propio una vez conectado (backlog P2-3,
    // docs/engineering/ALPHA_BACKLOG.md) -- Universal Links/AASA quedan
    // atados a este dominio, mejor conectarlo antes de configurar eso
    // (Fase 0 del plan) para no reconfigurar dos veces.
    url: "https://luz-app-joinluz.vercel.app",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
