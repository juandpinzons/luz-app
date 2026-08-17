import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLifeGraphContext } from "@/auth/user-context";
import { getLiveYoutubeContext } from "@/features/reality/get-live-youtube-context";
import { db } from "@/core/db/client";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, logger } from "@/core/observability/logger";
import { YoutubeVideoRow } from "@/features/home/components/youtube-video-row";
import { DisconnectButton } from "./disconnect-button";

const ROUTE = "/youtube";

const CONNECT_ERROR_LABEL: Record<string, string> = {
  denied: "No completaste el consentimiento en Google.",
  invalid_state: "La conexión expiró o no se pudo verificar. Intenta de nuevo.",
  not_configured: "La conexión con Google no está configurada todavía.",
  no_profile: "No se pudo cargar tu perfil. Intenta de nuevo en unos segundos.",
  connect_failed: "No pudimos conectar con YouTube. Intenta de nuevo.",
};

/**
 * Mismo patrón exacto que `/gmail` -- server component puro salvo
 * `DisconnectButton`. "Conectar" es un solo enlace a
 * `/api/youtube/connect` (inicia OAuth), no un formulario propio.
 */
export default async function YoutubePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const requestId = createRequestId();
  const { error } = await searchParams;

  const lifeGraphContext = await getLifeGraphContext();
  if (!lifeGraphContext) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-center text-white">
        <p className="text-zinc-400">No se pudo cargar tu perfil. Intenta de nuevo en unos segundos.</p>
      </main>
    );
  }

  const outcome = await getLiveYoutubeContext(db, lifeGraphContext.lifeGraphId);

  if (outcome.status === "error") {
    logger.log({
      event: "youtube.page.sync_failed",
      severity: "error",
      requestId,
      route: ROUTE,
      userId: session.user.id,
      lifeGraphId: lifeGraphContext.lifeGraphId,
      ...describeError(outcome.error),
    });
  }

  if (outcome.status === "not_connected") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
        <p className="text-2xl font-light">Ningún YouTube conectado</p>
        <p className="mt-3 max-w-sm text-zinc-400">
          Conecta tu cuenta de YouTube para que LUZ vea los videos que te gustaron -- otra ventana a lo que te interesa
          ahora. LUZ nunca ve tu historial de reproducción (YouTube no lo permite), ni puede dar like, suscribirse o
          publicar en tu nombre.
        </p>
        {error && (
          <p className="mt-4 text-sm text-red-400">{CONNECT_ERROR_LABEL[error] ?? "No se pudo conectar tu cuenta."}</p>
        )}
        <Link
          href="/api/youtube/connect"
          className="mt-8 inline-block rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200"
        >
          Conectar YouTube
        </Link>
      </main>
    );
  }

  const needsReauth = outcome.status === "needs_reauth";
  const snapshot = outcome.status === "connected" ? outcome.snapshot : null;

  return (
    <main className="flex min-h-screen flex-col items-center bg-black px-6 py-16 text-white">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-light">Tu YouTube</p>
            <p className="mt-1 text-sm text-zinc-500">{outcome.externalAccountId}</p>
          </div>
          <DisconnectButton />
        </div>

        {needsReauth && (
          <div className="mt-6 rounded-2xl border border-amber-900/50 bg-amber-950/20 px-5 py-4 text-sm text-amber-300">
            Tu acceso a YouTube expiró y necesita reautorizarse.
            <Link href="/api/youtube/connect" className="mt-2 block underline">
              Reconectar
            </Link>
          </div>
        )}

        {outcome.status === "error" && (
          <div className="mt-6 rounded-2xl border border-red-900/50 bg-red-950/20 px-5 py-4 text-sm text-red-300">
            No pudimos sincronizar con YouTube. Intenta de nuevo en unos minutos.
          </div>
        )}

        {snapshot && (
          <section className="mt-8">
            <h2 className="text-sm font-medium text-zinc-400">Te gustó</h2>
            {snapshot.likedVideos.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-600">Todavía no le diste like a ningún video.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {snapshot.likedVideos.map((video) => (
                  <YoutubeVideoRow key={video.id} video={video} />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
