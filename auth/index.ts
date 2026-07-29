import { cache } from "react";
import NextAuth from "next-auth";
import { authConfig } from "./config";

/**
 * Punto único de entrada de la Identity Layer. `app/api/auth/[...nextauth]/route.ts`,
 * `proxy.ts` (antes `middleware.ts` — renombrado en Next.js 16) y
 * `app/login/page.tsx` importan de aquí — nunca reconstruyen su propia
 * configuración de Auth.js.
 *
 * War Room 2026-07-29 (continuación): `authConfig.session.strategy =
 * "database"`, así que cada llamada a `auth()` resuelve la sesión
 * consultando `sessions`/`users` de verdad -- Auth.js v5 no memoiza
 * esto por su cuenta (verificado: no hay ningún `cache(` en
 * `next-auth/lib/index.js`). Varias páginas/rutas llaman `auth()` (o
 * `getUserContext()`/`getLifeGraphContext()`, que lo llaman
 * internamente) más de una vez en la misma petición --
 * `app/dashboard/page.tsx` lo hace tres veces, `app/api/chat/route.ts`
 * y `app/api/chat/welcome/route.ts` dos, cada una la ruta de mayor
 * tráfico de la aplicación. `React.cache()` deduplica automáticamente
 * llamadas repetidas a la misma función dentro de una única petición
 * (Server Components y Route Handlers comparten el mismo contexto de
 * petición en Next.js) -- ninguna llamada real a la base cambia de
 * comportamiento, solo se ejecuta una vez en vez de dos o tres.
 */
const { handlers, auth: resolveAuth, signIn, signOut } = NextAuth(authConfig);

export const auth = cache(resolveAuth);
export { handlers, signIn, signOut };
