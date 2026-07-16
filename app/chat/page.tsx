"use client";

import { useState } from "react";
import type { SendMessageResponse } from "@/features/chat/types";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();

  async function sendMessage() {
    if (message.trim() === "") return;

    const userMessage = message;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
      },
    ]);

    setMessage("");

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
          {messages.length === 0 ? (
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
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
            className="flex-1 rounded-xl bg-zinc-900 px-5 py-4 outline-none ring-1 ring-zinc-800 focus:ring-white"
          />

          <button
            onClick={sendMessage}
            className="rounded-xl bg-white px-6 text-black transition hover:bg-zinc-200"
          >
            Enviar
          </button>
        </div>
      </footer>
    </main>
  );
}