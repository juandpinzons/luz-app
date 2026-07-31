import type { ExternalMessageId, ExternalThreadId } from "./identifiers";

/**
 * Qué tan importante marcó el proveedor este mensaje. Unión cerrada
 * dimensionada para TODOS los proveedores objetivo (Gmail, Outlook --
 * mismo criterio que `CalendarEventStatus`), no solo para el primero
 * implementado: Gmail expone únicamente una marca binaria ("importante"
 * presente o no, vía la etiqueta de sistema `IMPORTANT`), así que su
 * mapper nunca produce `"low"` -- Microsoft Graph sí expone una escala
 * de tres niveles (`importance: low|normal|high`) de forma nativa. Un
 * mapper nunca debe inventar un nivel que su proveedor no señaló
 * realmente (mismo principio que `CalendarDescriptor.isPrimary` en el
 * proveedor de Apple: se documenta la limitación, no se aproxima).
 */
export const EMAIL_IMPORTANCE_LEVELS = ["low", "normal", "high"] as const;
export type EmailImportance = (typeof EMAIL_IMPORTANCE_LEVELS)[number];

/**
 * Remitente de un mensaje -- estructurado (no un string `"Nombre
 * <email>"` crudo) por el mismo motivo que `CalendarAttendee`: un
 * consumidor casi siempre necesita el email solo (para comparar contra
 * `EmailConnection.externalAccountId`, p. ej. al derivar la señal
 * `waiting_reply`, ver `../application/get-email-snapshot.ts`) y
 * obligarlo a re-parsear un string cada vez sería repetir trabajo que
 * el proveedor concreto ya hizo una vez al mapear.
 */
export interface EmailSender {
  readonly email: string;
  readonly displayName?: string;
}

/**
 * Representación neutral de un mensaje de correo -- la forma que
 * CUALQUIER proveedor (Gmail/Outlook, y cualquiera que se agregue
 * después) debe poder producir sin que nada aquí asuma su origen.
 * Mismo principio de frontera que `CalendarEvent`
 * (`./calendar-event.ts`): el resto de LUZ nunca debe saber si un
 * `EmailMessage` vino de Gmail o de Outlook.
 *
 * **Deliberadamente sin ningún campo de cuerpo/contenido** (ni
 * `body`, ni `bodyPreview`, ni `html`) -- no es un campo opcional sin
 * poblar, es una ausencia estructural a propósito. El alcance de esta
 * fase es metadata únicamente (misión explícita: "Never persist bodies
 * unless explicitly approved later"); que el contrato de dominio ni
 * siquiera tenga un lugar donde guardar un cuerpo hace estructuralmente
 * imposible que un proveedor futuro, o un consumidor futuro, lo agregue
 * por accidente sin decidirlo explícitamente (extender este tipo es un
 * cambio de dominio deliberado, nunca un `raw` que se filtra en uso
 * real -- ver abajo). `snippet` (un fragmento corto de vista previa que
 * el proveedor ya recorta, p. ej. `Message.snippet` de Gmail) es la
 * única aproximación al contenido que este cimiento modela.
 *
 * `labels` son ids/nombres tal como los expone el proveedor (p. ej.
 * `"INBOX"`, `"UNREAD"`, `"IMPORTANT"`, `"CATEGORY_PROMOTIONS"`, o un id
 * de etiqueta personalizada como `"Label_17"` en Gmail) -- opaco a
 * propósito, mismo criterio que `CalendarRecurrence.rule`: resolver un
 * id de etiqueta personalizada a un nombre legible requiere una llamada
 * aparte (`EmailProvider.listLabels()`) que un consumidor hace por su
 * cuenta si lo necesita: este contrato no la resuelve inline.
 */
export interface EmailMessage {
  readonly id: ExternalMessageId;
  readonly threadId: ExternalThreadId;
  readonly sender: EmailSender;
  readonly subject: string;
  /** Fragmento corto de vista previa ya recortado por el proveedor -- nunca el cuerpo completo (ver arriba). */
  readonly snippet: string;
  readonly receivedAt: Date;
  readonly labels: readonly string[];
  /** Derivado de la presencia/ausencia de la etiqueta de sistema `UNREAD` (Gmail) o su equivalente -- nunca inferido de otra cosa. */
  readonly unread: boolean;
  readonly importance: EmailImportance;
  readonly raw?: Readonly<Record<string, unknown>>;
}
