import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLifeGraphContext } from "@/auth/user-context";
import { getLiveEmailContext } from "@/core/email-connections/get-live-email-context";
import { db } from "@/core/db/client";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, logger } from "@/core/observability/logger";
import { EmailRow } from "@/features/home/components/email-row";
import { DisconnectButton } from "./disconnect-button";

const ROUTE = "/gmail";

const CONNECT_ERROR_LABEL: Record<string, string> = {
  denied: "No completaste el consentimiento en Google.",
  invalid_state: "La conexión expiró o no se pudo verificar. Intenta de nuevo.",
  not_configured: "La conexión con Google no está configurada todavía.",
  no_profile: "No se pudo cargar tu perfil. Intenta de nuevo en unos segundos.",
  connect_failed: "No pudimos conectar con Gmail. Intenta de nuevo.",
};

/**
 * Mismo patrón exacto que `/calendar` (mismo cimiento, `features/reality/`)
 * -- server component puro salvo `DisconnectButton`. A diferencia de
 * Calendar, "conectar" es un solo enlace a `/api/gmail/connect` (inicia
 * OAuth), no un formulario propio: no existe `/gmail/connect` como
 * página separada.
 */
export default async function GmailPage({
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

  const outcome = await getLiveEmailContext(db, lifeGraphContext.lifeGraphId);

  if (outcome.status === "error") {
    logger.log({
      event: "gmail.page.sync_failed",
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
        <p className="text-2xl font-light">Ningún correo conectado</p>
        <p className="mt-3 max-w-sm text-zinc-400">
          Conecta tu Gmail para que LUZ sepa qué correos son nuevos, importantes o siguen esperando respuesta. LUZ nunca lee
          el contenido de tus correos, solo metadata (remitente, asunto, fecha).
        </p>
        {error && (
          <p className="mt-4 text-sm text-red-400">{CONNECT_ERROR_LABEL[error] ?? "No se pudo conectar tu correo."}</p>
        )}
        <Link
          href="/api/gmail/connect"
          className="mt-8 inline-block rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200"
        >
          Conectar Gmail
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
            <p className="text-2xl font-light">Tu correo</p>
            <p className="mt-1 text-sm text-zinc-500">{outcome.externalAccountId}</p>
          </div>
          <DisconnectButton />
        </div>

        {needsReauth && (
          <div className="mt-6 rounded-2xl border border-amber-900/50 bg-amber-950/20 px-5 py-4 text-sm text-amber-300">
            Tu acceso a Gmail expiró y necesita reautorizarse.
            <Link href="/api/gmail/connect" className="mt-2 block underline">
              Reconectar
            </Link>
          </div>
        )}

        {outcome.status === "error" && (
          <div className="mt-6 rounded-2xl border border-red-900/50 bg-red-950/20 px-5 py-4 text-sm text-red-300">
            No pudimos sincronizar con Gmail. Intenta de nuevo en unos minutos.
          </div>
        )}

        {snapshot && (
          <>
            <section className="mt-8">
              <h2 className="text-sm font-medium text-zinc-400">Esperando respuesta</h2>
              {snapshot.waitingReply.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-600">Nada esperando respuesta.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {snapshot.waitingReply.map((message) => (
                    <EmailRow key={message.id} message={message} />
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-8">
              <h2 className="text-sm font-medium text-zinc-400">Importantes</h2>
              {snapshot.important.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-600">Nada marcado como importante.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {snapshot.important.map((message) => (
                    <EmailRow key={message.id} message={message} />
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-8">
              <h2 className="text-sm font-medium text-zinc-400">Recientes</h2>
              <p className="mt-1 text-xs text-zinc-600">
                {snapshot.unread.length} sin leer de los últimos {snapshot.recent.length}.
              </p>
              {snapshot.recent.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-600">Sin mensajes recientes.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {snapshot.recent.map((message) => (
                    <EmailRow key={message.id} message={message} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
