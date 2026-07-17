"use client";

import { useEffect, useState } from "react";
import type {
  GetLatestConversationResponse,
  SendMessageResponse,
} from "@/features/chat/types";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadLatestConversation() {
      try {
        const response = await fetch("/api/chat");

        if (!response.ok) {
          throw new Error("No se pudo recuperar la conversación.");
        }

        const data: GetLatestConversationResponse | null =
          await response.json();

        if (!cancelled && data) {
          // Si el usuario ya empezó a escribir (mensaje optimista ya en
          // pantalla) antes de que esta petición terminara, esta
          // respuesta ya está desactualizada — nunca debe sobreescribir
          // una conversación en curso, o el mensaje que se acaba de
          // mandar "desaparece" y el estado local queda desincronizado
          // del conversationId real que el servidor usó para guardarlo.
          setConversationId((prev) => prev ?? data.conversationId);
          setMessages((prev) => (prev.length === 0 ? data.messages : prev));
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    }

    loadLatestConversation();

    return () => {
      cancelled = true;
    };
  }, []);

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

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error("Error en la respuesta del servidor");
      }

      const data: SendMessageResponse = await response.json();

      setConversationId(data.conversationId);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
        },
      ]);
    } catch (error) {
      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "❌ Ocurrió un error al conectar con el servidor.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="flex h-screen flex-col bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-8 py-5">
        <h1 className="text-xl font-light tracking-[0.25em]">
          LUZ
        </h1>
      </header>

      {/* Conversación */}
      <section className="flex flex-1 px-6 py-8">
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

              {isSending && (
                <div className="mr-auto w-fit max-w-[80%] rounded-2xl bg-zinc-800 px-5 py-3 text-zinc-400">
                  LUZ está escribiendo…
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Input */}
      <footer className="border-t border-zinc-800 p-6">
        <div className="mx-auto flex max-w-4xl gap-3">
          <input
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