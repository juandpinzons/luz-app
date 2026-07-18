"use client";

import { useEffect } from "react";

/**
 * Error boundary de /chat (Sprint de Observabilidad, Alpha). Antes de
 * esto, un error de render en el cliente dejaba la pantalla en blanco
 * sin ninguna señal — mismo tipo de causa raíz que el bug real del
 * scroll (app/chat/page.tsx), solo que para excepciones de JS en vez
 * de CSS.
 */
export default function ChatError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        severity: "error",
        event: "client.render_error",
        route: "/chat",
        message: error.message,
        digest: error.digest,
      }),
    );
  }, [error]);

  return (
    <main className="flex h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
      <h2 className="text-2xl font-light">Algo se rompió del lado de LUZ.</h2>
      <p className="mt-3 text-zinc-400">
        Tu conversación sigue guardada — no se perdió nada.
      </p>
      <button
        onClick={() => unstable_retry()}
        className="mt-8 rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200"
      >
        Intentar de nuevo
      </button>
    </main>
  );
}
