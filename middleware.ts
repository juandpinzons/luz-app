import { auth } from "@/auth";

/**
 * Protege /chat (UI) y /api/chat (API) exigiendo sesión. La landing
 * (`/`) y `/login` quedan públicas a propósito.
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
  matcher: ["/chat/:path*", "/api/chat/:path*"],
};
