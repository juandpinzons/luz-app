import {
  EMAIL_SYNC_HARD_CEILING,
  type EmailConnection,
  type EmailMessage,
  type EmailProviderKind,
  type EmailSyncCursor,
  type EmailSyncOptions,
  type EmailSyncResult,
  createExternalMessageId,
} from "../../domain";
import type { EmailLabelDescriptor, EmailProvider } from "../email-provider";
import { GmailClient, type GmailApiMessage } from "./gmail-client";
import { mapGmailLabelToDescriptor, mapGmailMessagesToDomain } from "./gmail-mapper";

/**
 * `maxResults` para `history.list()` -- deliberadamente MAYOR que
 * `EMAIL_SYNC_HARD_CEILING`: un registro de historial no es un mensaje,
 * es un EVENTO (una etiqueta que cambió, un mensaje que llegó) --
 * varios eventos pueden apuntar al mismo mensaje. Pedir solo 10
 * registros de historial subestimaría cuántos mensajes distintos
 * cambiaron realmente desde el último cursor.
 */
const GMAIL_HISTORY_PAGE_SIZE = 50;

function clampMaxResults(requested: number | undefined): number {
  const effective = requested ?? EMAIL_SYNC_HARD_CEILING;
  return Math.max(1, Math.min(effective, EMAIL_SYNC_HARD_CEILING));
}

/**
 * Confirma que las credenciales inyectadas de verdad pertenecen a la
 * cuenta que esta `EmailConnection` dice representar -- control de
 * aislamiento defensivo: si algún llamador futuro llegara a construir
 * un `GmailProvider` con las credenciales de la cuenta EQUIVOCADA para
 * una conexión dada (bug de un consumidor, nunca de este cimiento),
 * esta comprobación lo detiene aquí, en vez de sincronizar en silencio
 * el correo de una persona hacia la conexión de otra.
 */
function assertAccountMatches(connection: EmailConnection, authenticatedEmail: string): void {
  if (connection.externalAccountId.trim().toLowerCase() !== authenticatedEmail.trim().toLowerCase()) {
    throw new Error(
      `GmailProvider: la cuenta autenticada ("${authenticatedEmail}") no coincide con externalAccountId de la conexión ${connection.id} ("${connection.externalAccountId}") -- sync abortado para evitar sincronizar la cuenta equivocada.`,
    );
  }
}

/**
 * Implementación de `EmailProvider` (`../email-provider`, sin
 * modificar) sobre Gmail API v1. Mismo reparto de responsabilidad que
 * `AppleCalendarProvider`: esta clase decide QUÉ hacer con los datos
 * del cliente (paginación, fusión de historial, el techo de 10
 * mensajes); `GmailClient` decide CÓMO hablar con Gmail.
 */
export class GmailProvider implements EmailProvider {
  readonly kind: EmailProviderKind = "gmail";

  constructor(private readonly client: GmailClient) {}

  async listLabels(connection: EmailConnection): Promise<readonly EmailLabelDescriptor[]> {
    void connection; // El cliente ya está autenticado contra una única cuenta -- no hace falta la conexión para decidir a quién preguntarle (mismo criterio que AppleCalendarProvider.listCalendars()).
    const labels = await this.client.listLabels();
    return labels.map(mapGmailLabelToDescriptor);
  }

  async sync(
    connection: EmailConnection,
    cursor: EmailSyncCursor | null,
    options?: EmailSyncOptions,
  ): Promise<EmailSyncResult> {
    const maxResults = clampMaxResults(options?.maxResults);

    return cursor ? this.syncIncremental(connection, cursor, maxResults) : this.syncInitial(connection, maxResults);
  }

  /**
   * Sin cursor previo: siembra el `historyId` inicial vía
   * `getProfile()` (ver docblock ahí, incluye el caso de buzón vacío),
   * lista como mucho `maxResults` mensajes, y obtiene cada uno
   * completo. `hasMore` es SIEMPRE `false` aquí -- a diferencia de
   * `syncIncremental`, esta función nunca pagina más allá de UNA
   * llamada a `listMessages()`, sin importar si Gmail señala más
   * resultados disponibles en el resto del buzón (`EMAIL_SYNC_HARD_
   * CEILING` es una política de privacidad de esta fase, no un límite
   * técnico a superar con más páginas -- ver `../../domain/email-sync-options.ts`).
   */
  private async syncInitial(connection: EmailConnection, maxResults: number): Promise<EmailSyncResult> {
    const profile = await this.client.getProfile();
    assertAccountMatches(connection, profile.emailAddress);

    const page = await this.client.listMessages(maxResults);
    const upserted = await this.fetchMessages(page.messages.map((message) => message.id));

    return {
      connectionId: connection.id,
      cursor: { providerKind: this.kind, token: profile.historyId, issuedAt: new Date() },
      upserted: sortByReceivedAtDesc(upserted),
      deleted: [],
      hasMore: false,
      syncedAt: new Date(),
    };
  }

  /**
   * Con cursor previo: usa la Change History API real de Gmail
   * (https://developers.google.com/gmail/api/guides/sync) en vez de
   * volver a listar mensajes -- `messagesAdded`/`labelsAdded`/
   * `labelsRemoved` se tratan igual (todos exigen releer el mensaje
   * completo para reflejar su estado actual, ver docblock de
   * `EmailSyncResult`: un cambio de etiqueta también es un "upsert");
   * `messagesDeleted` nunca necesita releerse. Un mismo id en ambos
   * conjuntos dentro de la misma página (borrado después de un cambio
   * de etiqueta, o viceversa) resuelve a "borrado" -- mismo criterio de
   * `applyEmailSyncResult`, aplicado aquí también para no pedirle a
   * `getMessage()` un mensaje que de todas formas terminará borrado.
   */
  private async syncIncremental(
    connection: EmailConnection,
    cursor: EmailSyncCursor,
    maxResults: number,
  ): Promise<EmailSyncResult> {
    const page = await this.client.listHistory(cursor.token, GMAIL_HISTORY_PAGE_SIZE);

    const changedIds = new Set<string>();
    const deletedIds = new Set<string>();

    for (const record of page.history) {
      for (const ref of record.messagesAdded ?? []) changedIds.add(ref.message.id);
      for (const ref of record.labelsAdded ?? []) changedIds.add(ref.message.id);
      for (const ref of record.labelsRemoved ?? []) changedIds.add(ref.message.id);
      for (const ref of record.messagesDeleted ?? []) deletedIds.add(ref.message.id);
    }
    for (const id of deletedIds) changedIds.delete(id);

    if (!page.historyId) {
      throw new Error(
        `GmailProvider.sync: history.list no devolvió historyId para la conexión ${connection.id} -- contrato de Gmail API violado.`,
      );
    }

    const upserted = await this.fetchMessages([...changedIds].slice(0, maxResults));

    return {
      connectionId: connection.id,
      cursor: { providerKind: this.kind, token: page.historyId, issuedAt: new Date() },
      upserted: sortByReceivedAtDesc(upserted),
      deleted: [...deletedIds].map(createExternalMessageId),
      hasMore: page.nextPageToken !== undefined,
      syncedAt: new Date(),
    };
  }

  /**
   * Aislamiento por mensaje -- mismo criterio que
   * `AppleCalendarProvider.sync()` por calendario (lección de
   * auditoría, `../apple/AUDIT.md` #5): un mensaje que falla al
   * obtenerse (p. ej. 404 -- borrado entre listar/historial y esta
   * llamada) nunca debe abortar el resto del lote. Secuencial a
   * propósito, no `Promise.all` -- evita ráfagas contra el límite de
   * cuota por segundo de Gmail API en un lote que, por diseño
   * (`EMAIL_SYNC_HARD_CEILING`), nunca es grande.
   */
  private async fetchMessages(ids: readonly string[]): Promise<EmailMessage[]> {
    const raws: GmailApiMessage[] = [];
    for (const id of ids) {
      try {
        raws.push(await this.client.getMessage(id));
      } catch (error) {
        console.error(`GmailProvider: se omitió el mensaje "${id}" por un error al obtenerlo.`, error);
      }
    }
    return mapGmailMessagesToDomain(raws);
  }
}

function sortByReceivedAtDesc(messages: readonly EmailMessage[]): EmailMessage[] {
  return [...messages].sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
}
