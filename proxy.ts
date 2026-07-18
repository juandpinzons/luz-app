import { auth } from "@/auth";

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
 */
export default auth((req) => {
  const isLoggedIn = Boolean(req.auth);
  const { pathname } = req.nextUrl;

  if (isLoggedIn) {
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
