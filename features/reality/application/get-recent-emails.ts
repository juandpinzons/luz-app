import type { EmailMessage } from "../domain";

export interface GetRecentEmailsOptions {
  /** Sin límite si se omite -- un consumidor que solo quiere "los últimos 3" lo pide explícitamente. */
  readonly limit?: number;
  readonly unreadOnly?: boolean;
}

/**
 * Accesor angosto sobre `EmailSnapshot.recent` -- mismo rol que
 * `getUpcomingEvents` en Calendar Foundation
 * (`./get-upcoming-events.ts`): para un consumidor que solo necesita
 * esta lista, sin pagar por calcular señales que no va a usar.
 * `getEmailSnapshot()` sigue siendo la fuente completa cuando se
 * necesita más de un pedazo.
 */
export function getRecentEmails(
  messages: readonly EmailMessage[],
  options?: GetRecentEmailsOptions,
): EmailMessage[] {
  const base = options?.unreadOnly ? messages.filter((message) => message.unread) : [...messages];
  const sorted = base.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
  return options?.limit !== undefined ? sorted.slice(0, options.limit) : sorted;
}
