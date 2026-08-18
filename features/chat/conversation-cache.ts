import type { GetLatestConversationResponse } from "@/features/chat/types";

const PREFIX = "luz:chat-cache:";

export type CachedConversationMessage = Omit<
  GetLatestConversationResponse["messages"][number],
  "imageData"
>;

export interface CachedConversation {
  conversationId: string;
  messages: CachedConversationMessage[];
  cachedAt: string;
}

function keyFor(conversationId: string): string {
  return `${PREFIX}${conversationId}`;
}

/**
 * Nunca cachea `imageData` -- son data URIs en base64 (pueden pesar
 * varios MB cada una) y la cuota de `localStorage` es compartida con
 * `draft-storage.ts`/`dashboard-cache.ts`; este respaldo es sobre
 * continuidad de texto al reabrir sin conexión, no sobre reproducir
 * imágenes exactas.
 */
export function writeCachedConversation(
  conversationId: string,
  messages: GetLatestConversationResponse["messages"],
): void {
  if (typeof window === "undefined") return;

  try {
    const value: CachedConversation = {
      conversationId,
      messages: messages.map(({ role, content }) => ({ role, content })),
      cachedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(keyFor(conversationId), JSON.stringify(value));
  } catch {
    // Cuota agotada, Safari privado, etc. -- el caché offline es una mejora, nunca un requisito.
  }
}

export function readCachedConversation(
  conversationId: string,
): CachedConversation | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(keyFor(conversationId));
    return raw ? (JSON.parse(raw) as CachedConversation) : null;
  } catch {
    return null;
  }
}
