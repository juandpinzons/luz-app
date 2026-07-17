import type { UserContext } from "../core/identity/user-context";
import { db } from "../core/db/client";
import type { LifeGraphContext } from "../core/life/life-graph-context";
import type { AccountIdentityResolver } from "./identity-resolver";
import { createAccountIdentityResolver } from "./drizzle-identity-resolver";
import { auth } from "./index";

let cachedResolver: AccountIdentityResolver | undefined;

function getResolver(): AccountIdentityResolver {
  if (!cachedResolver) {
    cachedResolver = createAccountIdentityResolver(db);
  }

  return cachedResolver;
}

/**
 * Traduce la sesión de Auth.js al `UserContext` del dominio.
 *
 * Es la única función de todo el proyecto que conoce ambos lados de la
 * separación pedida por el CTO: Auth.js/sesiones (Identity Layer) y
 * `UserContext` (dominio). Ninguna ruta, feature ni componente debe
 * leer `session.user` directamente — siempre a través de esta función.
 *
 * Devuelve `null` si no hay sesión. Qué hacer ante un usuario no
 * autenticado (401, redirect a /login...) lo decide quien la llama, no
 * este helper.
 */
export async function getUserContext(): Promise<UserContext | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return { userId: session.user.id };
}

/**
 * Resuelve la sesión actual hacia su LifeGraphContext (ADR-0011),
 * usando AccountIdentityResolver — que bootstrapea un LifeGraph nuevo
 * si la Account todavía no tiene uno. Coexiste con `getUserContext`
 * mientras el resto del dominio (features/chat, Memory, Knowledge)
 * siga recibiendo `UserContext`; migrar esos consumidores es un
 * milestone aparte.
 *
 * Devuelve `null` si no hay sesión, igual que `getUserContext`.
 */
export async function getLifeGraphContext(): Promise<LifeGraphContext | null> {
  const context = await getUserContext();

  if (!context) {
    return null;
  }

  return getResolver().resolve(context.userId);
}
