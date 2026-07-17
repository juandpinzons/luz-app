/**
 * Forma neutral de las credenciales que un `Connector` necesita para
 * llamar a una API externa — no importa el `provider` real (Google,
 * Garmin, Meta...), ni las columnas de `accounts` (`auth/schema.ts`).
 * Un futuro ensamblador traduce una fila de `accounts` a esta forma;
 * esa traducción es la frontera anti-corrupción, igual que
 * `core/reality` ya la exige para `RealitySnapshot` (ADR-0013) —
 * `core/connectors` nunca importa de `auth/`.
 */
export interface ConnectorCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}
