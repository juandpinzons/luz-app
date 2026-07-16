import type { UserContext } from "../core/identity/user-context";
import { auth } from "./index";

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
