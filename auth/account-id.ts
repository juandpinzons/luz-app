/**
 * Identificador de una Account (Auth.js `session.user.id`). Vive en
 * `auth/`, nunca en `core/life` — el dominio no tiene ni debe tener
 * ningún tipo que represente esto (ADR-0011).
 */
export type AccountId = string;
