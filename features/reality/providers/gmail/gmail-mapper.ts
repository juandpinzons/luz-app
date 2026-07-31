import {
  type EmailImportance,
  type EmailMessage,
  type EmailSender,
  createExternalMessageId,
  createExternalThreadId,
} from "../../domain";
import type { EmailLabelDescriptor } from "../email-provider";
import type { GmailApiLabel, GmailApiMessage } from "./gmail-client";

/**
 * Toda traducción entre las formas crudas de Gmail API y el dominio
 * (`../../domain`) vive exclusivamente aquí -- funciones puras, sin
 * I/O. `gmail-provider.ts` es el único llamador. Mismo reparto de
 * responsabilidad que `apple-calendar-mapper.ts`.
 */

function headerValue(message: GmailApiMessage, name: string): string | undefined {
  return message.payload?.headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value;
}

/**
 * `From` header (RFC 5322 §3.4) -> remitente estructurado. Formas
 * reales que este parser cubre: `"Nombre" <a@b.com>`, `Nombre
 * <a@b.com>`, y `a@b.com` sin nombre. No es un parser RFC 5322
 * completo (no maneja grupos de direcciones ni comentarios `(...)`,
 * ninguno de los dos aparece en un header `From` de un mensaje
 * individual real) -- suficiente para lo que Gmail devuelve.
 */
export function parseFromHeader(value: string): EmailSender {
  const match = /^(.*)<([^<>]+)>\s*$/.exec(value.trim());
  if (!match) {
    return { email: value.trim() };
  }

  const [, namePart, emailPart] = match;
  const displayName = (namePart ?? "").trim().replace(/^"|"$/g, "").trim();
  const email = (emailPart ?? "").trim();

  return displayName ? { email, displayName } : { email };
}

/**
 * Gmail solo señala una marca binaria de importancia (la etiqueta de
 * sistema `IMPORTANT`, presente o no) -- nunca produce `"low"`, ver
 * docblock de `EmailImportance` (`../../domain/email-message.ts`).
 */
function deriveImportance(labelIds: readonly string[]): EmailImportance {
  return labelIds.includes("IMPORTANT") ? "high" : "normal";
}

/**
 * `internalDate` (epoch ms como string, ver
 * https://developers.google.com/gmail/api/reference/rest/v1/users.messages#Message)
 * es la fecha de recepción real que Gmail asigna internamente --
 * preferida sobre el header `Date` (RFC 5322), que es texto libre que
 * el servidor REMITENTE escribió y puede faltar, estar mal formado, o
 * (en teoría) ser incorrecto a propósito. `Date` header queda como
 * respaldo únicamente si `internalDate` falta o no es un número válido
 * -- no debería pasar nunca según el contrato de la API, pero esta
 * función nunca asume que un campo "siempre presente" lo esté de
 * verdad (mismo criterio que `apple-calendar-mapper.ts`, que nunca
 * asume un `VEVENT` bien formado).
 */
function resolveReceivedAt(message: GmailApiMessage): Date | null {
  if (message.internalDate) {
    const epochMs = Number.parseInt(message.internalDate, 10);
    if (Number.isFinite(epochMs)) {
      return new Date(epochMs);
    }
  }

  const dateHeader = headerValue(message, "Date");
  if (dateHeader) {
    const parsed = new Date(dateHeader);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

/**
 * `GmailApiMessage` (`format=metadata`, ver `gmail-client.ts`) ->
 * `EmailMessage`. `null` si falta algo que el dominio exige y que
 * ningún valor por defecto razonable puede reemplazar (`From` o una
 * fecha de recepción resoluble) -- se descarta en vez de inventar un
 * valor, mismo criterio que `mapVEventBlock` descartando un `VEVENT`
 * sin `DTSTART`.
 */
export function mapGmailMessageToDomain(message: GmailApiMessage): EmailMessage | null {
  const fromHeader = headerValue(message, "From");
  const receivedAt = resolveReceivedAt(message);

  if (!fromHeader || !receivedAt) {
    return null;
  }

  const labelIds = message.labelIds ?? [];

  return {
    id: createExternalMessageId(message.id),
    threadId: createExternalThreadId(message.threadId),
    sender: parseFromHeader(fromHeader),
    subject: headerValue(message, "Subject")?.trim() ?? "",
    snippet: message.snippet ?? "",
    receivedAt,
    labels: labelIds,
    unread: labelIds.includes("UNREAD"),
    importance: deriveImportance(labelIds),
  };
}

/**
 * Un lote de mensajes crudos -> dominio, aislado por registro -- un
 * mensaje individual malformado (bug real posible: la API cambia,
 * un campo esperado falta) se descarta con `console.error` y no
 * aborta el resto del lote, mismo principio que
 * `mapSyncEntriesToEvents` en el proveedor de Apple (lección de
 * auditoría #5, `../apple/AUDIT.md`).
 */
export function mapGmailMessagesToDomain(messages: readonly GmailApiMessage[]): EmailMessage[] {
  const mapped: EmailMessage[] = [];

  for (const message of messages) {
    try {
      const domainMessage = mapGmailMessageToDomain(message);
      if (domainMessage) {
        mapped.push(domainMessage);
      }
    } catch (error) {
      console.error(`gmail-mapper: se descartó el mensaje "${message.id}" por un error inesperado al mapearlo.`, error);
    }
  }

  return mapped;
}

export function mapGmailLabelToDescriptor(label: GmailApiLabel): EmailLabelDescriptor {
  return {
    id: label.id,
    displayName: label.name,
    kind: label.type,
  };
}
