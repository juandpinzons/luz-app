import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { NextAuthConfig } from "next-auth";
import { db } from "../core/db/client";
import { recordEvent } from "../core/observability/record-event";
import { users } from "../core/db/schema/users";
import { providers } from "./providers";
import { accounts, sessions, verificationTokens } from "./schema";

/**
 * Configuración de Auth.js. Este es el único archivo del proyecto que
 * decide CÓMO se autentica un usuario (adapter, proveedores, estrategia
 * de sesión). El dominio (`core/`) nunca importa nada de aquí; solo
 * conoce `UserContext` (ver core/identity/user-context.ts).
 *
 * Sesiones de base de datos (no JWT): cada sesión vive como fila en
 * `sessions` (auth/schema.ts), revocable desde el servidor.
 */
export const authConfig: NextAuthConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: "database",
  },
  providers,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }

      return session;
    },
  },
  events: {
    async signIn({ user, isNewUser }) {
      if (!user.id) {
        return;
      }

      await recordEvent(db, {
        type: "auth_sign_in",
        userId: user.id,
        metadata: { isNewUser: Boolean(isNewUser) },
      });
    },
  },
};
