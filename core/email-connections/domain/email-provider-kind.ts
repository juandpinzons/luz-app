/**
 * Los proveedores de correo que este cimiento está diseñado para
 * soportar -- Gmail, Outlook (Microsoft Graph). Agregar un proveedor
 * nuevo es sumar un literal aquí + una clase nueva que implemente
 * `EmailProvider` (`../providers/email-provider`); ningún contrato de
 * este módulo cambia de forma por eso. Mismo criterio que
 * `CalendarProviderKind` (`./calendar-provider-kind.ts`).
 *
 * Unión cerrada a propósito, no un `string` suelto: cada consumidor
 * (lógica de reconexión, logging) puede hacer `switch` exhaustivo sobre
 * esto sin adivinar valores posibles.
 */
export const EMAIL_PROVIDER_KINDS = ["gmail", "outlook"] as const;

export type EmailProviderKind = (typeof EMAIL_PROVIDER_KINDS)[number];
