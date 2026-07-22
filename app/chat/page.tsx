"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { readDraft, writeDraft } from "@/features/chat/draft-storage";
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
/** Qué tan cerca del fondo (en px) cuenta como "ya estaba abajo" para el autoscroll inteligente. */
const NEAR_BOTTOM_THRESHOLD_PX = 120;

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
      fallback={<main className="flex h-full flex-col bg-black text-white" />}
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
  const scrollContainerRef = useRef<HTMLElement>(null);
  /**
   * Arranca en `true`: abrir el chat siempre ancla abajo, igual que
   * antes de este cambio. Un `ref` y no un `state` porque no debe
   * disparar un re-render — solo se lee dentro del efecto de scroll de
   * abajo y se escribe desde el handler de scroll y desde `sendMessage`.
   */
  const isNearBottomRef = useRef(true);
  /**
   * Espejo en `state` de `!isNearBottomRef`, solo para pintar el botón
   * "volver al final" — a diferencia del ref, esto sí debe disparar un
   * re-render, pero solo cuando cruza el umbral (nunca en cada pixel de
   * scroll: la actualización funcional de abajo evita el re-render si
   * el valor no cambió).
   */
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNear = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX;
    isNearBottomRef.current = isNear;
    setShowScrollToBottom((prev) => (prev === !isNear ? prev : !isNear));
  }

  function scrollToBottom() {
    isNearBottomRef.current = true;
    setShowScrollToBottom(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  useEffect(() => {
    // Solo sigue el streaming si la persona ya estaba abajo — si scrolleó
    // arriba para releer algo, un chunk nuevo no debe secuestrar su
    // posición (autoscroll inteligente).
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages, isSending, isThinking]);

  /** Evita hidratar el borrador dos veces, y evita escribir en localStorage antes de que la hidratación haya corrido una vez (ver `hydrateDraft` y el efecto de más abajo). */
  const hasHydratedDraftRef = useRef(false);

  /**
   * Se llama desde dentro de `loadConversation` (abajo), nunca desde un
   * efecto síncrono: recién ahí se conoce el `conversationId` real que
   * resolvió esta carga (puede diferir del state si ya había una
   * conversación en curso, ver los comentarios de cada rama). Usa la
   * forma funcional de `setMessage` para nunca pisar texto que la
   * persona ya haya escrito mientras el historial cargaba.
   */
  function hydrateDraft(resolvedConversationId: string | undefined) {
    if (hasHydratedDraftRef.current) return;
    hasHydratedDraftRef.current = true;

    setMessage((current) => {
      if (current.trim() !== "") return current;
      return readDraft(resolvedConversationId) || current;
    });
  }

  useEffect(() => {
    // `conversationId` no está en las dependencias a propósito: este
    // efecto solo debe reaccionar a texto nuevo, nunca a que
    // `conversationId` se resuelva de forma asíncrona (vía el evento
    // `meta` del stream) — para cuando eso pasa, `sendMessage` ya dejó
    // `message` en "", así que no habría nada real que escribir, y
    // escribir en ese momento arriesgaría pisar un borrador recién
    // hidratado con un valor todavía desactualizado de este render.
    if (!hasHydratedDraftRef.current) return;
    writeDraft(conversationId, message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  useEffect(() => {
    let cancelled = false;

    async function loadConversation() {
      // "Nueva conversación" ya dejó el estado exactamente como debe
      // quedar — este disparo del efecto es solo el eco de haber
      // limpiado la URL, no debe volver a traer nada.
      if (suppressNextLoadRef.current) {
        suppressNextLoadRef.current = false;
        setIsLoadingHistory(false);
        hydrateDraft(undefined);
        return;
      }

      // Guarda el id que esta carga efectivamente resolvió, para
      // hidratar el borrador con la misma llave — nunca se lee de vuelta
      // el `conversationId` del state porque puede haber quedado
      // desactualizado por una carrera con un envío ya en curso (ver
      // los comentarios de cada rama de abajo).
      let resolvedConversationId: string | undefined;

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
            resolvedConversationId = detailData.conversationId;

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
              resolvedConversationId = data.conversationId;
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
          hydrateDraft(resolvedConversationId);
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
    setMessage("");
    isNearBottomRef.current = true;
    setShowScrollToBottom(false);
    // Se re-arma para que el efecto de hidratación vuelva a correr con
    // la llave "new" — si había un borrador sin enviar de una sesión
    // "nueva" anterior, se recupera; si no, no hace nada.
    hasHydratedDraftRef.current = false;
    setConversationId(undefined);
    setIsHistoricalConversation(false);
    setHistoricalLabel(null);
    router.replace("/chat");
    inputRef.current?.focus();
  }

  async function sendMessage() {
    if (message.trim() === "" || isSending) return;

    const userMessage = message;

    // Enviar siempre ancla abajo, sin importar dónde estaba el scroll —
    // misma convención que cualquier app de mensajería: la persona debe
    // ver su propio mensaje aterrizar.
    isNearBottomRef.current = true;
    setShowScrollToBottom(false);

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
    <main className="flex h-full flex-col bg-black text-white">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-zinc-800 px-8 py-5">
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
      <div className="relative min-h-0 flex-1">
        <section
          ref={scrollContainerRef}
          onScroll={handleScroll}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Conversación con LUZ"
          tabIndex={0}
          className="h-full overflow-y-auto px-6 py-8 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-zinc-700"
        >
          <div className="mx-auto w-full max-w-3xl">
            {isLoadingHistory ? (
              // Misma geometría que las burbujas reales (rounded-2xl,
              // max-w-[80%]) para que no haya salto de layout al llegar
              // el historial de verdad.
              <div className="space-y-4">
                <Skeleton className="ml-auto h-11 w-40" />
                <Skeleton className="mr-auto h-16 w-64" />
                <Skeleton className="ml-auto h-11 w-52" />
              </div>
            ) : messages.length === 0 ? (
              <div className="mt-32 text-center">
                <h2 className="text-4xl font-light">¿Cómo te sientes hoy?</h2>

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
                        ? "ml-auto w-fit max-w-[80%] animate-fade-in rounded-2xl bg-white px-5 py-3 text-black"
                        : "mr-auto w-fit max-w-[80%] animate-fade-in rounded-2xl bg-zinc-800 px-5 py-3 text-white"
                    }
                  >
                    {msg.content}
                  </div>
                ))}

                {isThinking && (
                  <div className="mr-auto w-fit max-w-[80%] animate-fade-in rounded-2xl bg-zinc-800 px-5 py-3 text-zinc-400">
                    LUZ está escribiendo…
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </section>

        {showScrollToBottom && (
          <button
            onClick={scrollToBottom}
            aria-label="Ir al final de la conversación"
            className="animate-fade-in absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 shadow-lg transition hover:border-zinc-500 hover:text-white"
          >
            ↓ Ir al final
          </button>
        )}
      </div>

      {/* Input */}
      <footer className="flex-shrink-0 border-t border-zinc-800 p-6">
        <div className="mx-auto flex max-w-4xl gap-3">
          <input
            ref={inputRef}
            type="text"
            placeholder="Escribe un mensaje..."
            aria-label="Escribe un mensaje para LUZ"
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
            aria-label="Enviar mensaje"
            aria-busy={isSending}
            className="rounded-xl bg-white px-6 text-black transition hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-white"
          >
            {isSending ? "..." : "Enviar"}
          </button>
        </div>
      </footer>
    </main>
  );
}