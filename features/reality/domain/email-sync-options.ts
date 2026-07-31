/**
 * Techo absoluto de mensajes que CUALQUIER `EmailProvider` puede dejar
 * conocidos a la vez -- no un default cómodo, un límite de producto
 * explícito (misión "Gmail Foundation": "Synchronize only recent email
 * metadata. Do NOT store complete mailboxes. Initial scope: last 10
 * emails"). A diferencia de `CalendarSyncOptions.pageSizeHint` (una
 * sugerencia, nunca una garantía), este valor SÍ se hace cumplir en
 * código -- ver `providers/gmail/gmail-provider.ts`
 * (`clampMaxResults`) y `apply-email-sync-result.ts` (el merge nunca
 * deja más de `EMAIL_SYNC_HARD_CEILING` mensajes conocidos, incluso
 * sincronización tras sincronización). Un `EmailSyncOptions.maxResults`
 * mayor a este valor se recorta, nunca se respeta tal cual.
 */
export const EMAIL_SYNC_HARD_CEILING = 10;

/**
 * Parámetros de una llamada a `EmailProvider.sync()`. `maxResults` es
 * un pedido del llamador, siempre sujeto a `EMAIL_SYNC_HARD_CEILING`
 * (ver arriba) -- mismo espíritu que `pageSizeHint` en
 * `CalendarSyncOptions` (una preferencia, no una promesa exacta del
 * proveedor), pero con un techo real en vez de solo una sugerencia,
 * porque aquí el techo es la política de privacidad de esta fase, no
 * solo una optimización.
 */
export interface EmailSyncOptions {
  readonly maxResults?: number;
}
