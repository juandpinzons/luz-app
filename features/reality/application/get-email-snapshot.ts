import type {
  EmailConnection,
  EmailMessage,
  EmailSnapshot,
  EmailSyncStatusInfo,
  EmailThreadSummary,
} from "../domain";
import type { ExternalThreadId } from "../domain/identifiers";

/** Una ventana de mensajes recibidos dentro de las últimas N horas cuenta como "reciente" para la señal `new_email` -- 24h es un valor de producto razonable (un día natural), no una constante técnica; ajustable vía `EmailSnapshotOptions.newEmailWindowHours`. */
const DEFAULT_NEW_EMAIL_WINDOW_HOURS = 24;

/** Piso de antigüedad para que un mensaje no leído cuente como "esperando respuesta" (`waiting_reply`) -- sin este piso, CUALQUIER mensaje no leído de otra persona calificaría en el mismo instante en que llega, indistinguible de la señal `unread_email`. 4h es un valor de producto ("ya tuvo tiempo razonable de notarse"), ajustable vía `EmailSnapshotOptions.waitingReplyMinAgeHours`. */
const DEFAULT_WAITING_REPLY_MIN_AGE_HOURS = 4;

const HOUR_MS = 60 * 60 * 1000;

export interface EmailSnapshotOptions {
  readonly now?: Date;
  readonly newEmailWindowHours?: number;
  readonly waitingReplyMinAgeHours?: number;
}

/** Mismo criterio que `deriveSyncStatus` en `get-calendar-snapshot.ts` -- deriva de `EmailConnection.status`, nunca de un detalle de Gmail/Outlook. */
function deriveSyncStatus(connection: EmailConnection): EmailSyncStatusInfo {
  if (connection.status === "disconnected") {
    return { state: "disconnected", lastSyncedAt: connection.updatedAt };
  }
  if (connection.status === "needs_reauth") {
    return { state: "error", lastSyncedAt: connection.updatedAt, errorMessage: "needs_reauth" };
  }
  if (connection.status === "error") {
    return { state: "error", lastSyncedAt: connection.updatedAt, errorMessage: "sync_failed" };
  }
  if (connection.createdAt.getTime() === connection.updatedAt.getTime()) {
    return { state: "never_synced" };
  }
  return { state: "up_to_date", lastSyncedAt: connection.updatedAt };
}

/** Agrupa por `threadId` -- señal `recent_thread`. Orden por mensaje más reciente del hilo, descendente, para que el hilo con actividad más nueva quede primero. */
function buildRecentThreads(sortedMessages: readonly EmailMessage[]): EmailThreadSummary[] {
  const byThread = new Map<ExternalThreadId, EmailMessage[]>();

  for (const message of sortedMessages) {
    const existing = byThread.get(message.threadId);
    if (existing) {
      existing.push(message);
    } else {
      byThread.set(message.threadId, [message]);
    }
  }

  const summaries: EmailThreadSummary[] = [];
  for (const threadMessages of byThread.values()) {
    // `sortedMessages` (el arreglo de entrada) ya viene ordenado por
    // `receivedAt` descendente -- el primer mensaje de cada grupo ya es
    // el más reciente de ese hilo, sin necesidad de un segundo sort.
    const [latestMessage] = threadMessages;
    if (!latestMessage) continue;

    summaries.push({
      threadId: latestMessage.threadId,
      messageCount: threadMessages.length,
      latestMessage,
      hasUnread: threadMessages.some((message) => message.unread),
    });
  }

  return summaries.sort((a, b) => b.latestMessage.receivedAt.getTime() - a.latestMessage.receivedAt.getTime());
}

/**
 * Construye la vista canónica de producto (`EmailSnapshot`,
 * `../domain/email-snapshot.ts`) a partir de un conjunto de mensajes ya
 * conocido -- pura, sin I/O, sin conocer ningún proveedor. Mismo
 * principio que `getCalendarSnapshot`: `messages` es responsabilidad de
 * quien llama (este cimiento no persiste nada).
 *
 * **Definición exacta de cada señal** (documentada aquí, no en el
 * dominio -- mismo criterio que Calendar: el contrato dice QUÉ es cada
 * campo, este caso de uso decide CÓMO se calcula):
 *
 * - `new_email`: `receivedAt` cae dentro de las últimas
 *   `newEmailWindowHours` horas antes de `now` (nunca en el futuro
 *   respecto a `now`) -- ventana de recencia, mismo espíritu que
 *   `today` en `CalendarSnapshot` (una ventana de tiempo, no un delta
 *   contra una sincronización anterior: esta función es pura sobre una
 *   lista estática, no tiene forma de saber qué es "nuevo desde la
 *   última vez que alguien miró" sin ese estado, que este cimiento
 *   deliberadamente no guarda).
 * - `important_email`: `importance === "high"`.
 * - `unread_email`: `unread === true`.
 * - `waiting_reply`: no leído, el remitente NO es la propia cuenta
 *   (`EmailConnection.externalAccountId`), y ya pasaron al menos
 *   `waitingReplyMinAgeHours` horas desde que llegó -- usa
 *   `externalAccountId` (dato ya conocido por la conexión, ver
 *   `../domain/email-connection.ts`) para una definición estructural
 *   real ("alguien más me escribió y no le he prestado atención"), no
 *   una heurística de contenido.
 * - `recent_thread`: mensajes agrupados por `threadId` (ver
 *   `buildRecentThreads`).
 *
 * Todo determinista: mismos `messages`/`connection`/`options` producen
 * siempre el mismo `EmailSnapshot` (salvo `generatedAt`, que refleja
 * `now`).
 */
export function getEmailSnapshot(
  messages: readonly EmailMessage[],
  connection: EmailConnection,
  options?: EmailSnapshotOptions,
): EmailSnapshot {
  const now = options?.now ?? new Date();
  const newEmailWindowMs = (options?.newEmailWindowHours ?? DEFAULT_NEW_EMAIL_WINDOW_HOURS) * HOUR_MS;
  const waitingReplyMinAgeMs = (options?.waitingReplyMinAgeHours ?? DEFAULT_WAITING_REPLY_MIN_AGE_HOURS) * HOUR_MS;
  const ownAddress = connection.externalAccountId.trim().toLowerCase();

  const recent = [...messages].sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

  const newEmails = recent.filter((message) => {
    const ageMs = now.getTime() - message.receivedAt.getTime();
    return ageMs >= 0 && ageMs <= newEmailWindowMs;
  });

  const unread = recent.filter((message) => message.unread);
  const important = recent.filter((message) => message.importance === "high");

  const waitingReply = recent.filter((message) => {
    if (!message.unread) return false;
    if (message.sender.email.trim().toLowerCase() === ownAddress) return false;
    return now.getTime() - message.receivedAt.getTime() >= waitingReplyMinAgeMs;
  });

  return {
    generatedAt: now,
    recent,
    newEmails,
    unread,
    important,
    waitingReply,
    recentThreads: buildRecentThreads(recent),
    syncStatus: deriveSyncStatus(connection),
  };
}
