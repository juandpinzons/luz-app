/**
 * Qué dispositivo/proveedor originó estas métricas -- mismo criterio
 * que `CalendarProviderKind`/`EmailProviderKind`: un valor por
 * adaptador concreto, nunca una cadena libre. Solo "garmin" hoy;
 * Fitbit/Apple Health/Oura serían adaptadores futuros del mismo
 * puerto (`WearableProvider`), no un cambio de forma en este tipo.
 */
export const WEARABLE_PROVIDER_KINDS = ["garmin"] as const;
export type WearableProviderKind = (typeof WEARABLE_PROVIDER_KINDS)[number];
