import { and, eq, gte } from "drizzle-orm";
import { db } from "../core/db/client";
import { conversationMessages, conversations } from "../core/db/schema/conversations";
import { events } from "../core/db/schema/events";
import { smokeFetch } from "./utils/http";
import type { SmokeContext, SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const SMOKE_MESSAGE =
  "Mensaje de smoke test -- quiero terminar mi certificación de AWS este trimestre.";

const TITLE_POLL_TIMEOUT_MS = 20_000;
const TITLE_POLL_INTERVAL_MS = 1_000;

/**
 * Esta es exactamente la regresión del 2026-07-24: el título solo se
 * genera si el `after()` registrado por `app/api/chat/route.ts` (ver
 * `backgroundTasksReady` en `send-message.ts`) de verdad corre después
 * de que el stream termina -- si alguien vuelve a mover ese `after()`
 * a un generador o servicio interno (ADR-0017, amendment), este poll
 * nunca encuentra el título y el flujo falla.
 */
async function pollForTitle(
  conversationId: string,
): Promise<string | null> {
  const deadline = Date.now() + TITLE_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    if (conversation?.title) {
      return conversation.title;
    }
    await new Promise((resolve) => setTimeout(resolve, TITLE_POLL_INTERVAL_MS));
  }
  return null;
}

export const firstMessageFlow: SmokeFlow = {
  name: "first-message",
  async run(ctx: SmokeContext) {
    const testStartedAt = new Date();

    const res = await smokeFetch("/api/chat", ctx.sessionCookie, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ message: SMOKE_MESSAGE }),
    });

    assert(res.status === 200, `POST /api/chat devolvió ${res.status}, se esperaba 200`);
    assert(res.body, "la respuesta no trajo body de stream");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let chunkCount = 0;
    let conversationId: string | undefined;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const piece = decoder.decode(value, { stream: true });
      full += piece;
      chunkCount += (piece.match(/event: chunk/g) ?? []).length;
      if (!conversationId) {
        const match = full.match(/"conversationId":"([^"]+)"/);
        if (match) conversationId = match[1];
      }
    }

    assert(conversationId, "no llegó `conversationId` en el evento `meta`");
    assert(
      chunkCount > 1,
      `solo llegó ${chunkCount} evento(s) de chunk -- no parece streaming real, revisa Accept negotiation`,
    );

    const messages = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId));
    assert(
      messages.some((m) => m.role === "user"),
      "no se persistió el mensaje del usuario en `conversation_messages`",
    );
    assert(
      messages.some((m) => m.role === "assistant"),
      "no se persistió la respuesta de LUZ en `conversation_messages`",
    );

    const title = await pollForTitle(conversationId);
    assert(
      title,
      `el título de la conversación sigue null después de ${TITLE_POLL_TIMEOUT_MS}ms -- la tarea de fondo de finalizeReply no corrió`,
    );

    const newErrors = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.type, "error"),
          eq(events.route, "POST /api/chat"),
          gte(events.createdAt, testStartedAt),
        ),
      );
    assert(
      newErrors.length === 0,
      `se registraron ${newErrors.length} error(es) nuevos en POST /api/chat durante la prueba: ${newErrors.map((e) => e.message).join(" | ")}`,
    );
  },
};
