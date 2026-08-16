import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLifeGraphContext } from "@/auth/user-context";
import { getLiveCalendarContext } from "@/features/home/services/get-live-calendar-context";
import { db } from "@/core/db/client";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, logger } from "@/core/observability/logger";
import { EventRow } from "@/features/home/components/event-row";
import { DisconnectButton } from "./disconnect-button";

const ROUTE = "/calendar";
const UPCOMING_WINDOW_DAYS = 14;

const STATUS_LABEL: Record<string, string> = {
  up_to_date: "Sincronizado",
  never_synced: "Nunca sincronizado",
  syncing: "Sincronizando...",
  error: "Error de sincronización",
  disconnected: "Desconectado",
};

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const requestId = createRequestId();

  const lifeGraphContext = await getLifeGraphContext();
  if (!lifeGraphContext) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-center text-white">
        <p className="text-zinc-400">No se pudo cargar tu perfil. Intenta de nuevo en unos segundos.</p>
      </main>
    );
  }

  const outcome = await getLiveCalendarContext(db, lifeGraphContext.lifeGraphId);

  if (outcome.status === "not_connected") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
        <p className="text-2xl font-light">Ningún calendario conectado</p>
        <p className="mt-3 max-w-sm text-zinc-400">
          Conecta tu Apple Calendar para que LUZ sepa qué tienes ocupado, libre y próximo.
        </p>
        <Link
          href="/calendar/connect"
          className="mt-8 inline-block rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200"
        >
          Conectar calendario
        </Link>
      </main>
    );
  }

  if (outcome.status === "error") {
    logger.log({
      event: "calendar.page.sync_failed",
      severity: "error",
      requestId,
      route: ROUTE,
      userId: session.user.id,
      lifeGraphId: lifeGraphContext.lifeGraphId,
      ...describeError(outcome.error),
    });
  }

  const { calendarContext } = outcome.status === "connected" ? outcome : { calendarContext: null };

  return (
    <main className="flex min-h-screen flex-col items-center bg-black px-6 py-16 text-white">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-light">Tu calendario</p>
            <p className="mt-1 text-sm text-zinc-500">{outcome.externalAccountId}</p>
          </div>
          <DisconnectButton />
        </div>

        <p className="mt-4 text-sm text-zinc-400">
          {calendarContext ? STATUS_LABEL[calendarContext.status] ?? calendarContext.status : "Error de sincronización"}
        </p>

        {outcome.status === "error" && (
          <div className="mt-6 rounded-2xl border border-red-900/50 bg-red-950/20 px-5 py-4 text-sm text-red-300">
            No pudimos sincronizar con Apple Calendar. Verifica que la contraseña específica de app siga siendo válida.
            <Link href="/calendar/connect" className="mt-2 block underline">
              Reconectar
            </Link>
          </div>
        )}

        {calendarContext && (
          <>
            <section className="mt-8">
              <h2 className="text-sm font-medium text-zinc-400">Hoy</h2>
              {calendarContext.today.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-600">Nada agendado hoy.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {calendarContext.today.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-8">
              <h2 className="text-sm font-medium text-zinc-400">Próximos</h2>
              {calendarContext.upcomingEvents.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-600">Nada próximo en los siguientes {UPCOMING_WINDOW_DAYS} días.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {calendarContext.upcomingEvents.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </ul>
              )}
            </section>

            {calendarContext.recurringCommitments.length > 0 && (
              <section className="mt-8">
                <h2 className="text-sm font-medium text-zinc-400">Compromisos recurrentes</h2>
                <ul className="mt-3 space-y-2">
                  {calendarContext.recurringCommitments.map((commitment) => (
                    <li
                      key={`${commitment.title}-${commitment.rule}`}
                      className="rounded-lg border border-zinc-800 px-4 py-3 text-sm text-zinc-200"
                    >
                      {commitment.title}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-8">
              <h2 className="text-sm font-medium text-zinc-400">Tiempo libre</h2>
              <p className="mt-3 text-sm text-zinc-500">
                {calendarContext.freeBlocks.length} bloque{calendarContext.freeBlocks.length === 1 ? "" : "s"} libre
                {calendarContext.freeBlocks.length === 1 ? "" : "s"} en los próximos {UPCOMING_WINDOW_DAYS} días.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
