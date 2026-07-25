"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

/** Error boundary de /dashboard (Sprint de Observabilidad, Alpha). */
export default function DashboardError({
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
        route: "/dashboard",
        message: error.message,
        digest: error.digest,
      }),
    );
  }, [error]);

  return (
    <ErrorState
      title="No pudimos cargar tu día."
      description="Intenta de nuevo en un momento."
      onRetry={() => unstable_retry()}
      fullHeight={false}
    />
  );
}
