import type { EmailMessage } from "./email-message";
import type { ExternalThreadId } from "./identifiers";

/**
 * Uno o más `EmailMessage` del mismo `threadId`, agrupados -- mismo
 * espíritu que `BusyPeriod` en Calendar Foundation (fusiona lo
 * relacionado en una sola entrada de producto en vez de dejar que el
 * consumidor repita ese trabajo). `latestMessage` es el mensaje más
 * reciente del hilo DENTRO de lo ya conocido por este cimiento (que
 * hoy es, como mucho, `EMAIL_SYNC_HARD_CEILING` mensajes -- ver
 * `./email-sync-options.ts`) -- nunca una garantía de que sea el último
 * mensaje real del hilo completo en el proveedor.
 */
export interface EmailThreadSummary {
  readonly threadId: ExternalThreadId;
  readonly messageCount: number;
  readonly latestMessage: EmailMessage;
  readonly hasUnread: boolean;
}

/**
 * Estado de sincronización en términos de producto -- deriva de
 * `EmailConnection.status`, nunca de un detalle de Gmail/Outlook. Mismo
 * vocabulario que `CalendarSyncStatusInfo`
 * (`./calendar-snapshot.ts`), definido de forma independiente (ver
 * `EmailConnectionStatus`, `./email-connection.ts`, para por qué no se
 * reutiliza el tipo de Calendar).
 */
export const EMAIL_SYNC_STATES = ["never_synced", "syncing", "up_to_date", "error", "disconnected"] as const;
export type EmailSyncState = (typeof EMAIL_SYNC_STATES)[number];

export interface EmailSyncStatusInfo {
  readonly state: EmailSyncState;
  readonly lastSyncedAt?: Date;
  readonly errorMessage?: string;
}

/**
 * La vista canónica de correo que el resto de LUZ consume -- único
 * punto de contacto entre "Gmail Foundation" y cualquier feature de
 * producto, mismo rol que `CalendarSnapshot` cumple para Calendar
 * Foundation (misión: "Expose a clean Reality interface similar to
 * Calendar"). Vocabulario exclusivamente de producto: nada de headers
 * MIME, nada específico de Gmail/Outlook.
 *
 * Cada campo (salvo `recent`/`generatedAt`/`syncStatus`) corresponde a
 * UNA de las cinco señales pedidas por la misión
 * (`new_email`/`important_email`/`unread_email`/`waiting_reply`/
 * `recent_thread`) -- mismo patrón que `CalendarSnapshot`, donde
 * `today`/`upcoming`/`freeBlocks`/`busyPeriods`/`recurringCommitments`
 * SON directamente las señales de producto de Calendar, no una lista
 * genérica envuelta en un tipo "Signal". Todas se derivan de forma pura
 * (sin I/O) a partir de `messages` + `now`, nunca de un estado oculto
 * -- ver `../application/get-email-snapshot.ts` para las reglas
 * exactas de cada una (documentadas ahí, no aquí, mismo criterio que
 * Calendar: el contrato dice QUÉ es cada campo, el caso de uso decide
 * CÓMO se calcula).
 */
export interface EmailSnapshot {
  readonly generatedAt: Date;
  /** Todos los mensajes conocidos, orden `receivedAt` descendente -- como mucho `EMAIL_SYNC_HARD_CEILING` (`./email-sync-options.ts`). */
  readonly recent: readonly EmailMessage[];
  /** Señal `new_email`. */
  readonly newEmails: readonly EmailMessage[];
  /** Señal `unread_email`. */
  readonly unread: readonly EmailMessage[];
  /** Señal `important_email`. */
  readonly important: readonly EmailMessage[];
  /** Señal `waiting_reply`. */
  readonly waitingReply: readonly EmailMessage[];
  /** Señal `recent_thread`. */
  readonly recentThreads: readonly EmailThreadSummary[];
  readonly syncStatus: EmailSyncStatusInfo;
}
