"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

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
    <ErrorState
      title="Algo se rompió del lado de LUZ."
      description="Tu conversación sigue guardada — no se perdió nada."
      onRetry={() => unstable_retry()}
    />
  );
}
