export interface GmailCredentials {
  readonly accessToken: string;
  /** Sin esto, un access token expirado no puede renovarse -- el cliente lo señala como `GmailAuthExpiredError` en vez de intentar un refresh imposible. */
  readonly refreshToken?: string;
  /** Epoch ms -- opcional. Sin esto, el cliente solo puede reaccionar a un 401 real, nunca refrescar de forma proactiva. */
  readonly expiresAt?: number;
  /** Necesarios solo para refrescar `accessToken` vía `refreshToken` (RFC 6749 §6: un cliente confidencial, que es lo que un backend de LUZ es, debe autenticarse ante el token endpoint). */
  readonly clientId?: string;
  readonly clientSecret?: string;
}
