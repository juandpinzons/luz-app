/** Mismo shape exacto que `GmailCredentials` (`core/email-connections/domain/gmail-credentials.ts`) -- ambos son credenciales OAuth de Google, mismo mecanismo de refresh (RFC 6749 §6). */
export interface YoutubeCredentials {
  readonly accessToken: string;
  /** Sin esto, un access token expirado no puede renovarse -- el cliente lo señala como `YoutubeAuthExpiredError` en vez de intentar un refresh imposible. */
  readonly refreshToken?: string;
  /** Epoch ms -- opcional. Sin esto, el cliente solo puede reaccionar a un 401 real, nunca refrescar de forma proactiva. */
  readonly expiresAt?: number;
  /** Necesarios solo para refrescar `accessToken` vía `refreshToken`. */
  readonly clientId?: string;
  readonly clientSecret?: string;
}
