/**
 * Un solo literal hoy (misión "shell nativo iOS", 2026-08-18) -- mismo
 * criterio que `YoutubeProviderKind`/`CalendarProviderKind`: unión
 * cerrada desde el día uno, para que agregar Android más adelante sea
 * sumar un literal, nunca una migración de esquema.
 */
export const DEVICE_PUSH_PLATFORMS = ["ios"] as const;
export type DevicePushPlatform = (typeof DEVICE_PUSH_PLATFORMS)[number];

/**
 * APNs tiene endpoints DISTINTOS para sandbox (builds de desarrollo/
 * TestFlight) y producción (App Store) -- un token registrado bajo el
 * ambiente equivocado nunca entrega la notificación, sin error visible
 * del lado del cliente. Nunca se infiere: cada registro lo declara
 * explícito (ver `app/api/push/register/route.ts`).
 */
export const PUSH_ENVIRONMENTS = ["sandbox", "production"] as const;
export type PushEnvironment = (typeof PUSH_ENVIRONMENTS)[number];
