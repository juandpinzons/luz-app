"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { useCachedDashboardSnapshot } from "@/features/dashboard/use-cached-dashboard-snapshot";

const CACHE_TIME_FORMAT = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  hour: "numeric",
  minute: "2-digit",
});

/** Error boundary de /dashboard (Sprint de Observabilidad, Alpha; Fase 2 offline mínimo). */
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const cached = useCachedDashboardSnapshot();

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

  if (!cached) {
    return (
      <ErrorState
        title="No pudimos cargar tu día."
        description="Intenta de nuevo en un momento."
        onRetry={() => unstable_retry()}
        fullHeight={false}
      />
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-6 py-16 text-white">
      <div className="w-full max-w-xl">
        <div className="animate-fade-in space-y-1">
          <p className="text-2xl font-light text-zinc-100">{cached.greeting}</p>
          {cached.dateLine && <p className="text-sm text-zinc-500">{cached.dateLine}</p>}
        </div>

        {cached.continuityLine && (
          <div className="animate-fade-in mt-6 rounded-2xl border border-luz/25 bg-zinc-900/60 px-5 py-4 text-zinc-200">
            {cached.continuityLine}
          </div>
        )}

        <p className="mt-6 text-sm text-zinc-500">
          Viendo una versión guardada de las {CACHE_TIME_FORMAT.format(new Date(cached.cachedAt))}.
        </p>

        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-4 rounded-full border border-zinc-700 px-5 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
