import type { EntityId } from "../../../core/life/value-objects/entity-id";
import type { EmailMessage } from "./email-message";
import type { EmailSyncCursor } from "./email-sync-cursor";
import type { ExternalMessageId } from "./identifiers";

/**
 * Resultado de UNA llamada a `EmailProvider.sync()` -- un delta, no un
 * snapshot completo del correo. Mismo contrato que `CalendarSyncResult`
 * (`./calendar-sync-result.ts`): `upserted` cubre mensajes nuevos Y
 * mensajes ya conocidos cuyo estado cambió (p. ej. se marcaron como
 * leídos -- Gmail no distingue "nuevo" de "estado cambiado" de forma
 * confiable en su API de historial), `deleted` son ids únicamente.
 *
 * `cursor` es SIEMPRE el nuevo cursor a persistir para la próxima
 * sincronización, incluso cuando `hasMore` es `true`.
 */
export interface EmailSyncResult {
  readonly connectionId: EntityId;
  readonly cursor: EmailSyncCursor;
  readonly upserted: readonly EmailMessage[];
  readonly deleted: readonly ExternalMessageId[];
  /** `true` si el proveedor tiene más resultados de ESTA misma pasada de sincronización -- el llamador vuelve a invocar `sync()` con `cursor` para continuar. En la práctica, con `EMAIL_SYNC_HARD_CEILING = 10` (`./email-sync-options.ts`), ningún `EmailProvider` correcto debería necesitar más de una página. */
  readonly hasMore: boolean;
  readonly syncedAt: Date;
}
