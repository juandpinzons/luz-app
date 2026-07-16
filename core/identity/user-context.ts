/**
 * Identidad del usuario dentro del dominio.
 *
 * Deliberadamente mínimo y agnóstico de CÓMO se autenticó el usuario
 * (Google, GitHub, email, credenciales...) — esa responsabilidad es
 * exclusiva de la Identity Layer (`auth/`). El dominio (`core/`,
 * `features/`) solo necesita saber QUIÉN es el usuario autenticado, no
 * el mecanismo que lo verificó.
 *
 * Todo acceso al dominio recibe un `UserContext`, nunca un `userId`
 * suelto ni un id hardcodeado.
 */
export interface UserContext {
  userId: string;
}
