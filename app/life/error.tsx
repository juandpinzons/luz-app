"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

/** Error boundary de /life. Antes de esto, un fallo acá caía en el reset completo de app/global-error.tsx. */
export default function LifeError({
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
        route: "/life",
        message: error.message,
        digest: error.digest,
      }),
    );
  }, [error]);

  return (
    <ErrorState
      title="No pudimos cargar tu vida."
      description="Intenta de nuevo en un momento."
      onRetry={() => unstable_retry()}
      fullHeight={false}
    />
  );
}
