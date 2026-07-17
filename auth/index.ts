import NextAuth from "next-auth";
import { authConfig } from "./config";

/**
 * Punto único de entrada de la Identity Layer. `app/api/auth/[...nextauth]/route.ts`,
 * `proxy.ts` (antes `middleware.ts` — renombrado en Next.js 16) y
 * `app/login/page.tsx` importan de aquí — nunca reconstruyen su propia
 * configuración de Auth.js.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
