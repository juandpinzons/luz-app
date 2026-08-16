export interface AppleCalendarCredentials {
  /** El Apple ID (email) de la cuenta. */
  readonly appleId: string;
  /**
   * Contraseña específica de app generada en appleid.apple.com --
   * NUNCA la contraseña real de la cuenta (iCloud CalDAV la rechaza
   * si 2FA está activo, que es obligatorio para todo Apple ID hoy).
   * Apple no ofrece OAuth para CalDAV -- este es el único mecanismo de
   * autenticación disponible, ver README de `../../`.
   */
  readonly appSpecificPassword: string;
}
