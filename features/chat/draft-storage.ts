const PREFIX = "luz:draft:chat:";

function keyFor(conversationId: string | undefined): string {
  return `${PREFIX}${conversationId ?? "new"}`;
}

/**
 * Un borrador solo importa antes de enviarse — una vez enviado, no
 * queda nada que persistir para ese turno, así que no hace falta
 * migrar la llave de "new" al id real cuando `conversationId` se
 * resuelve (llega vía el evento `meta` del stream): para cuando eso
 * pasa, cualquier borrador en curso ya se limpió al enviar.
 */
export function readDraft(conversationId: string | undefined): string {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(keyFor(conversationId)) ?? "";
  } catch {
    return "";
  }
}

export function writeDraft(
  conversationId: string | undefined,
  value: string,
): void {
  if (typeof window === "undefined") return;

  try {
    if (value.trim() === "") {
      window.localStorage.removeItem(keyFor(conversationId));
    } else {
      window.localStorage.setItem(keyFor(conversationId), value);
    }
  } catch {
    // Safari privado, cuota agotada, etc. — el borrador simplemente no
    // persiste, nunca debe romper el chat.
  }
}
