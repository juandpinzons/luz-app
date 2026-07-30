import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLifeGraphContext } from "@/auth/user-context";
import {
  getStoredCalendarConnection,
  markCalendarConnectionError,
  markCalendarConnectionSynced,
} from "@/core/calendar-connections/repository";
import { db } from "@/core/db/client";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, logger } from "@/core/observability/logger";
import { applySyncResult, getCalendarSnapshot, synchronizeCalendar } from "@/features/reality/application";
import type { CalendarEvent } from "@/features/reality/domain";
import { AppleCalendarClient, AppleCalendarProvider } from "@/features/reality/providers/apple";
import { buildCalendarContext } from "@/features/home/services/build-calendar-context";
import type { HomeCalendarContext } from "@/features/home/domain/home-state";
import { DisconnectButton } from "./disconnect-button";

const ROUTE = "/calendar";

/**
 * Ventana de sincronización en vivo -- este V1 no persiste eventos ni
 * cursor (ver `core/calendar-connections/repository.ts`), así que cada
 * carga de esta página hace un sync completo acotado por fecha, nunca
 * incremental. Correcto y simple; el costo es una llamada de red real a
 * iCloud en cada visita -- aceptable para una sola persona con un
 * calendario personal, no pensado para escalar sin agregar persistencia
 * de eventos + cursor más adelante (ver `features/reality/README.md`,
 * "Puntos de extensión #2").
 */
const SYNC_WINDOW_DAYS_BACK = 3;
const SYNC_WINDOW_DAYS_FORWARD = 14;

const TIME_FORMAT = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Bogota",
});

const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Bogota",
});

function eventStart(event: CalendarEvent): Date {
  return event.timing.isAllDay ? new Date(`${event.timing.date}T00:00:00Z`) : event.timing.dateTime;
}

function formatEventWhen(event: CalendarEvent): string {
  if (event.timing.isAllDay) return "Todo el día";
  return `${TIME_FORMAT.format(event.timing.dateTime)} – ${TIME_FORMAT.format(event.timing.endDateTime)}`;
}

function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <li className="rounded-lg border border-zinc-800 px-4 py-3 text-sm">
      <p className="text-zinc-100">{event.title}</p>
      <p className="mt-1 text-zinc-500">
        {DATE_FORMAT.format(eventStart(event))} · {formatEventWhen(event)}
      </p>
    </li>
  );
}

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

  const stored = await getStoredCalendarConnection(db, lifeGraphContext.lifeGraphId, "apple");

  if (!stored || stored.connection.status === "disconnected") {
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

  let calendarContext: HomeCalendarContext | null = null;
  let syncError: string | null = null;

  try {
    const provider = new AppleCalendarProvider(new AppleCalendarClient(stored.credentials));
    const now = new Date();
    const window = {
      from: new Date(now.getTime() - SYNC_WINDOW_DAYS_BACK * 24 * 60 * 60 * 1000),
      to: new Date(now.getTime() + SYNC_WINDOW_DAYS_FORWARD * 24 * 60 * 60 * 1000),
    };

    const syncResult = await synchronizeCalendar(provider, stored.connection, null, { window });
    const events = applySyncResult([], syncResult.upserted, syncResult.deleted);
    const snapshot = getCalendarSnapshot(events, syncResult.connection, { now, upcomingWindowDays: SYNC_WINDOW_DAYS_FORWARD });

    calendarContext = buildCalendarContext(snapshot);
    await markCalendarConnectionSynced(db, stored.connection.id);
  } catch (error) {
    const detail = describeError(error);
    logger.log({
      event: "calendar.page.sync_failed",
      severity: "error",
      requestId,
      route: ROUTE,
      userId: session.user.id,
      lifeGraphId: lifeGraphContext.lifeGraphId,
      ...detail,
    });
    await markCalendarConnectionError(db, stored.connection.id);
    syncError = "No pudimos sincronizar con Apple Calendar. Verifica que la contraseña específica de app siga siendo válida.";
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-black px-6 py-16 text-white">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-light">Tu calendario</p>
            <p className="mt-1 text-sm text-zinc-500">{stored.connection.externalAccountId}</p>
          </div>
          <DisconnectButton />
        </div>

        <p className="mt-4 text-sm text-zinc-400">
          {calendarContext ? STATUS_LABEL[calendarContext.status] ?? calendarContext.status : "Error de sincronización"}
        </p>

        {syncError && (
          <div className="mt-6 rounded-2xl border border-red-900/50 bg-red-950/20 px-5 py-4 text-sm text-red-300">
            {syncError}
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
                <p className="mt-3 text-sm text-zinc-600">Nada próximo en los siguientes {SYNC_WINDOW_DAYS_FORWARD} días.</p>
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
                    <li key={`${commitment.title}-${commitment.rule}`} className="rounded-lg border border-zinc-800 px-4 py-3 text-sm text-zinc-200">
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
                {calendarContext.freeBlocks.length === 1 ? "" : "s"} en los próximos {SYNC_WINDOW_DAYS_FORWARD} días.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
