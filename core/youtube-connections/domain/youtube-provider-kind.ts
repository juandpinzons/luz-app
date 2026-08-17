/**
 * Los proveedores de video que este cimiento está diseñado para
 * soportar -- hoy solo YouTube. Mismo criterio que
 * `EmailProviderKind`/`CalendarProviderKind` (`core/email-connections/domain/`,
 * `core/calendar-connections/domain/`): unión cerrada, no un `string`
 * suelto, para que un `switch` sobre esto sea exhaustivo. Un solo
 * literal hoy no es sobre-ingeniería -- es la misma columna
 * `providerKind` que ya usan las otras dos tablas de conexión, para que
 * agregar un segundo proveedor de video en el futuro sea sumar un
 * literal aquí, nunca una migración de esquema.
 */
export const YOUTUBE_PROVIDER_KINDS = ["youtube"] as const;

export type YoutubeProviderKind = (typeof YOUTUBE_PROVIDER_KINDS)[number];
