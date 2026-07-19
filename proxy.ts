import { and, eq, gt } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/core/db/client";
import { sessions } from "@/auth/schema";
import { logger } from "@/core/observability/logger";

/**
 * Protege /chat, /dashboard, /admin (UI) y /api/chat (API) exigiendo
 * sesión. La landing (`/`) y `/login` quedan públicas a propósito.
 * Desde Sprint Alpha-1a, /dashboard es la puerta de entrada post-login
 * (ver app/login/page.tsx) — necesita la misma protección que /chat.
 *
 * /admin exige además ser un email autorizado (`ADMIN_EMAILS`) — esa
 * segunda verificación vive en `app/admin/page.tsx`, no aquí: el proxy
 * solo garantiza "hay sesión", nunca "qué puede ver esa sesión".
 *
 * Las rutas de API devuelven 401 JSON; las rutas de UI redirigen a
 * /login — cada una con la respuesta que su cliente espera.
 *
 * Verificación de respaldo (2026-07-19): se observó en producción que
 * `req.auth` (el chequeo interno de Auth.js) puede venir vacío de
 * forma intermitente para una sesión real y válida — confirmado con
 * evidencia real: una persona fue redirigida a /login y, sin volver a
 * loguearse, la MISMA sesión funcionó de nuevo segundos después. Causa
 * raíz exacta no confirmada (candidata: el proxy corre en un contexto
 * de ejecución separado de las rutas de API, con su propio arranque
 * en frío de conexión a la base de datos). Mientras se investiga a
 * fondo, este respaldo consulta `sessions` directamente antes de
 * rechazar — nunca antes de que Auth.js diga que sí, solo cuando dice
 * que no, así que no debilita la seguridad: sigue exigiendo un token
 * de sesión real y no expirado, solo le da una segunda oportunidad a
 * una verificación que ya sabemos que a veces falla sin motivo.
 */
const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
];

async function hasValidSessionCookie(req: {
  cookies: { get(name: string): { value: string } | undefined };
}): Promise<boolean> {
  const token = SESSION_COOKIE_NAMES.map((name) => req.cookies.get(name)?.value).find(
    (value) => value,
  );

  if (!token) {
    return false;
  }

  const [session] = await db
    .select({ expires: sessions.expires })
    .from(sessions)
    .where(and(eq(sessions.sessionToken, token), gt(sessions.expires, new Date())))
    .limit(1);

  return Boolean(session);
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  if (req.auth) {
    return;
  }

  const recovered = await hasValidSessionCookie(req);

  logger.log({
    event: recovered ? "auth.proxy_fallback_recovered" : "auth.proxy_rejected",
    severity: recovered ? "warn" : "info",
    route: pathname,
  });

  if (recovered) {
    return;
  }

  if (pathname.startsWith("/api/")) {
    return Response.json(
      { error: "No autenticado." },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/login", req.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", pathname);

  return Response.redirect(loginUrl);
});

export const config = {
  matcher: ["/chat/:path*", "/dashboard/:path*", "/admin/:path*", "/api/chat/:path*"],
};
