"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  GetLatestConversationResponse,
  SendMessageErrorResponse,
} from "@/features/chat/types";

type Message = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Distingue "el servidor respondió y explicó qué pasó" (mensaje seguro
 * para mostrar tal cual — límite de mensajes, sesión expirada, etc.,
 * ya escritos con cuidado en app/api/chat/route.ts) de una falla real
 * de red (fetch nunca llegó a responder), cuyo mensaje de navegador
 * nunca debería llegar a la persona tal cual.
 */
class ChatRequestError extends Error {}

/**
 * Un evento Server-Sent Events ya separado en `event:`/`data:` (ver
 * `sseMessage` en app/api/chat/route.ts) — `data` siempre viaja como
 * JSON, así que se parsea aquí, no se deja como string crudo.
 */
interface ParsedSSEEvent {
  event: string;
  data: unknown;
}

function parseSSEMessage(raw: string): ParsedSSEEvent | null {
  let event = "message";
  let dataLine: string | undefined;

  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLine = line.slice("data:".length).trim();
    }
  }

  if (dataLine === undefined) return null;

  try {
    return { event, data: JSON.parse(dataLine) };
  } catch {
    return null;
  }
}

/**
 * `startedAt` llega como ISO string en la URL (ver `?startedAt=` en el
 * enlace "Continuar esta conversación" de `/conversations/[id]`) — la
 * única fuente de esa fecha, ya que ni `GET /api/chat` ni
 * `GET /api/conversations/[id]` la exponen (este sprint no toca la
 * API). Si falta o no se puede parsear, `null` — el indicador cae al
 * texto genérico en vez de romperse.
 */
function parseStartedAtParam(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Fecha en formato humano, nunca timestamp — "hoy"/"ayer"/"hace N
 * días" hasta una semana, después la fecha absoluta ("15 de julio",
 * con año solo si es distinto del actual).
 */
function formatHistoricalLabel(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays <= 0) return "Retomando una conversación de hoy";
  if (diffDays === 1) return "Retomando una conversación de ayer";
  if (diffDays < 7) {
    return `Retomando una conversación de hace ${diffDays} días`;
  }

  const formatted = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }).format(date);

  return `Retomando una conversación del ${formatted}`;
}

/**
 * `useSearchParams` exige un boundary `<Suspense>` para no romper el
 * build de producción (verificado en la documentación de Next.js de
 * este proyecto) — de ahí la separación entre este wrapper y
 * `ChatPageContent`, que tiene toda la lógica real.
 */
export default function ChatPage() {
  return (
    <Suspense
      fallback={<main className="flex h-screen flex-col bg-black text-white" />}
    >
      <ChatPageContent />
    </Suspense>
  );
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Sprint de conversaciones persistentes: presente cuando se llega
  // desde "Continuar esta conversación" (/conversations/[id]) o desde
  // una tarjeta de conversación reciente del Dashboard — ausente en el
  // uso normal, que sigue cargando la más reciente exactamente igual
  // que antes.
  const conversationIdParam = searchParams.get("conversationId");
  const startedAtParam = searchParams.get("startedAt");

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isSending, setIsSending] = useState(false);
  /**
   * Distinto de `isSending`: solo cubre la espera ANTES de que llegue
   * el primer fragmento real de la respuesta (ADR-0017) — controla
   * únicamente el indicador "LUZ está escribiendo…", que debe
   * desaparecer en cuanto el texto empieza a crecer, no cuando termina
   * de generarse por completo.
   */
  const [isThinking, setIsThinking] = useState(false);
  /**
   * Nunca se decide solo por si `conversationIdParam` existe (ver el
   * efecto de abajo): un enlace puede apuntar a la conversación que
   * de todas formas ya es la más reciente, y en ese caso el encabezado
   * debe quedar limpio igual que en el uso normal.
   */
  const [isHistoricalConversation, setIsHistoricalConversation] =
    useState(false);
  const [historicalLabel, setHistoricalLabel] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Evita que el efecto de carga de historial reponga la conversación anterior justo después de "Nueva conversación" (ver `startNewConversation`). */
  const suppressNextLoadRef = useRef(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isSending, isThinking]);

  useEffect(() => {
    let cancelled = false;

    async function loadConversation() {
      // "Nueva conversación" ya dejó el estado exactamente como debe
      // quedar — este disparo del efecto es solo el eco de haber
      // limpiado la URL, no debe volver a traer nada.
      if (suppressNextLoadRef.current) {
        suppressNextLoadRef.current = false;
        setIsLoadingHistory(false);
        return;
      }

      try {
        if (conversationIdParam) {
          // Se piden en paralelo la conversación solicitada Y la
          // realmente más reciente (GET /api/chat, sin parámetros, sin
          // tocar nada del backend) — comparar sus ids es el único
          // criterio para decidir "isHistoricalConversation". Nunca se
          // decide solo por la presencia de `conversationIdParam`: un
          // enlace puede apuntar a la conversación que de todas formas
          // ya es la más reciente (ej. desde una tarjeta del Dashboard),
          // y en ese caso no es histórica.
          const [detailResponse, latestResponse] = await Promise.all([
            fetch(`/api/conversations/${conversationIdParam}`),
            fetch("/api/chat"),
          ]);

          if (!detailResponse.ok) {
            throw new Error("No se pudo recuperar la conversación.");
          }

          const detailData: GetLatestConversationResponse | null =
            await detailResponse.json();
          const latestData: GetLatestConversationResponse | null =
            latestResponse.ok ? await latestResponse.json() : null;

          if (!cancelled && detailData) {
            const historical =
              !latestData ||
              latestData.conversationId !== detailData.conversationId;

            setConversationId((prev) => prev ?? detailData.conversationId);
            setMessages((prev) =>
              prev.length === 0 ? detailData.messages : prev,
            );
            setIsHistoricalConversation(historical);

            const startedAt = parseStartedAtParam(startedAtParam);
            setHistoricalLabel(
              historical
                ? formatHistoricalLabel(startedAt ?? new Date())
                : null,
            );
          }
        } else {
          const response = await fetch("/api/chat");

          if (!response.ok) {
            throw new Error("No se pudo recuperar la conversación.");
          }

          const data: GetLatestConversationResponse | null =
            await response.json();

          if (!cancelled) {
            if (data) {
              // Si el usuario ya empezó a escribir (mensaje optimista ya
              // en pantalla) antes de que esta petición terminara, esta
              // respuesta ya está desactualizada — nunca debe
              // sobreescribir una conversación en curso, o el mensaje
              // que se acaba de mandar "desaparece" y el estado local
              // queda desincronizado del conversationId real que el
              // servidor usó para guardarlo.
              setConversationId((prev) => prev ?? data.conversationId);
              setMessages((prev) =>
                prev.length === 0 ? data.messages : prev,
              );
            }
            setIsHistoricalConversation(false);
            setHistoricalLabel(null);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    }

    loadConversation();

    return () => {
      cancelled = true;
    };
  }, [conversationIdParam, startedAtParam]);

  function startNewConversation() {
    suppressNextLoadRef.current = true;
    setMessages([]);
    setConversationId(undefined);
    setIsHistoricalConversation(false);
    setHistoricalLabel(null);
    router.replace("/chat");
    inputRef.current?.focus();
  }

  async function sendMessage() {
    if (message.trim() === "" || isSending) return;

    const userMessage = message;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
      },
    ]);

    setMessage("");
    setIsSending(true);
    setIsThinking(true);

    // Visible también en el catch: si el stream ya entregó texto real
    // antes de fallar, el mensaje de error se agrega a lo que ya llegó
    // en vez de reemplazarlo — nunca se descarta una respuesta parcial
    // real por un fallo posterior (ADR-0017).
    let receivedAnyChunk = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // ADR-0017: pide explícitamente la capacidad de streaming —
          // sin este header, /api/chat responde JSON como siempre.
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message: userMessage,
          conversationId,
        }),
      });

      if (!response.ok) {
        const errorMessage = await response
          .json()
          .then((data: SendMessageErrorResponse) => data.error)
          .catch(() => undefined);

        throw new ChatRequestError(
          errorMessage ??
            "No se pudo procesar el mensaje. Intenta de nuevo en unos segundos.",
        );
      }

      if (!response.body) {
        throw new ChatRequestError(
          "No se pudo procesar el mensaje. Intenta de nuevo en unos segundos.",
        );
      }

      const reader = response.body.getReader();
      // `stream: true` evita partir un carácter UTF-8 multibyte (á, ñ,
      // é...) a la mitad si el límite de un chunk cae justo en medio.
      const decoder = new TextDecoder();
      // Los eventos SSE no siempre llegan alineados con los límites de
      // cada `read()` — se acumulan aquí hasta tener al menos un "\n\n"
      // completo antes de parsear.
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const raw = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          const parsed = parseSSEMessage(raw);
          if (parsed?.event === "meta") {
            const meta = parsed.data as { conversationId?: string };
            if (meta.conversationId) {
              setConversationId(meta.conversationId);
            }
          } else if (parsed?.event === "chunk") {
            const chunkText = parsed.data as string;

            if (!receivedAnyChunk) {
              receivedAnyChunk = true;
              setIsThinking(false);
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: chunkText },
              ]);
            } else {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                next[next.length - 1] = {
                  ...last,
                  content: last.content + chunkText,
                };
                return next;
              });
            }
          }

          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      console.error(error);

      const fallback =
        error instanceof ChatRequestError
          ? error.message
          : "Algo no salió bien de mi lado. ¿Lo intentamos de nuevo?";

      if (receivedAnyChunk) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = {
            ...last,
            content: `${last.content}\n\n${fallback}`,
          };
          return next;
        });
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: fallback },
        ]);
      }
    } finally {
      setIsSending(false);
      setIsThinking(false);
    }
  }

  return (
    <main className="flex h-screen flex-col bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-8 py-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-light tracking-[0.25em]">LUZ</h1>

          {!isLoadingHistory && isHistoricalConversation && (
            <button
              onClick={startNewConversation}
              className="rounded-full border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Nueva conversación
            </button>
          )}
        </div>

        {!isLoadingHistory && isHistoricalConversation && historicalLabel && (
          <p className="mt-1 text-sm text-zinc-500">{historicalLabel}</p>
        )}
      </header>

      {/* Conversación */}
      <section className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto w-full max-w-3xl">
          {isLoadingHistory ? null : messages.length === 0 ? (
            <div className="mt-32 text-center">
              <h2 className="text-4xl font-light">
                ¿Cómo te sientes hoy?
              </h2>

              <p className="mt-5 text-lg text-zinc-400">
                Estoy aquí para escucharte.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={
                    msg.role === "user"
                      ? "ml-auto w-fit max-w-[80%] rounded-2xl bg-white px-5 py-3 text-black"
                      : "mr-auto w-fit max-w-[80%] rounded-2xl bg-zinc-800 px-5 py-3 text-white"
                  }
                >
                  {msg.content}
                </div>
              ))}

              {isThinking && (
                <div className="mr-auto w-fit max-w-[80%] rounded-2xl bg-zinc-800 px-5 py-3 text-zinc-400">
                  LUZ está escribiendo…
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </section>

      {/* Input */}
      <footer className="border-t border-zinc-800 p-6">
        <div className="mx-auto flex max-w-4xl gap-3">
          <input
            ref={inputRef}
            type="text"
            placeholder="Escribe un mensaje..."
            value={message}
            disabled={isSending}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
            className="flex-1 rounded-xl bg-zinc-900 px-5 py-4 outline-none ring-1 ring-zinc-800 focus:ring-white disabled:opacity-50"
          />

          <button
            onClick={sendMessage}
            disabled={isSending}
            className="rounded-xl bg-white px-6 text-black transition hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-white"
          >
            {isSending ? "..." : "Enviar"}
          </button>
        </div>
      </footer>
    </main>
  );
}