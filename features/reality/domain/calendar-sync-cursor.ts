import type { CalendarProviderKind } from "./calendar-provider-kind";

/**
 * Estado de sincronización incremental, opaco a propósito -- envuelve
 * el `syncToken` de Google, el `changeToken`/`X-Apple-...-Token` de
 * EventKit/CalDAV, o el `@odata.deltaLink` de Microsoft Graph, sin que
 * este cimiento intente entender, parsear ni validar el contenido de
 * `token`. Solo el `CalendarProvider` que lo emitió sabe qué significa
 * -- cualquier otro consumidor lo trata como una cadena opaca que
 * guarda y reenvía tal cual.
 *
 * `null` (no un `CalendarSyncCursor` vacío) es la forma de decir
 * "primera sincronización, sin cursor previo" -- ver
 * `CalendarProvider.sync()`.
 */
export interface CalendarSyncCursor {
  readonly providerKind: CalendarProviderKind;
  readonly token: string;
  readonly issuedAt: Date;
}
