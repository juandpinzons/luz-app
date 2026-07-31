import type { EmailProviderKind } from "./email-provider-kind";

/**
 * Estado de sincronización incremental, opaco a propósito -- mismo
 * principio que `CalendarSyncCursor` (`./calendar-sync-cursor.ts`):
 * envuelve el `historyId` de Gmail o el `@odata.deltaLink` de Microsoft
 * Graph, sin que este cimiento intente entender, parsear ni validar el
 * contenido de `token`. Solo el `EmailProvider` que lo emitió sabe qué
 * significa -- cualquier otro consumidor lo trata como una cadena
 * opaca que guarda y reenvía tal cual.
 *
 * `null` (no un `EmailSyncCursor` vacío) es la forma de decir "primera
 * sincronización, sin cursor previo" -- ver `EmailProvider.sync()`.
 */
export interface EmailSyncCursor {
  readonly providerKind: EmailProviderKind;
  readonly token: string;
  readonly issuedAt: Date;
}
