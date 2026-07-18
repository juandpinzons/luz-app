"use client";

import { useEffect } from "react";

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
      <h2 className="text-2xl font-light">No pudimos cargar tu Dashboard.</h2>
      <p className="mt-3 text-zinc-400">Intenta de nuevo en un momento.</p>
      <button
        onClick={() => unstable_retry()}
        className="mt-8 rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200"
      >
        Intentar de nuevo
      </button>
    </main>
  );
}
