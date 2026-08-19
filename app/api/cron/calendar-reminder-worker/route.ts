import { NextResponse } from "next/server";
import { resolveUserIdForLifeGraph } from "@/auth/resolve-user-id-for-life-graph";
import { db } from "@/core/db/client";
import { DrizzleLifeGraphRepository } from "@/core/life";
import { isCronAuthorized } from "@/core/observability/is-cron-authorized";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";
import { withTimeout } from "@/core/observability/with-timeout";
import { sendPushNotification } from "@/core/push-notifications/send-push-notification";
import { getLiveCalendarContext } from "@/features/home/services/get-live-calendar-context";
import type { CalendarEvent } from "@/features/reality/domain";

const ROUTE = "GET /api/cron/calendar-reminder-worker";

/**
 * Misión "shell nativo iOS" (Fase 4, resto), 2026-08-19 -- el
 * disparador "tu reunión empieza pronto" que `app/api/cron/continuity-worker/route.ts`
 * dejó fuera a propósito: necesita precisión de minutos, y el plan
 * Hobby de Vercel solo permite una corrida diaria. Cron aparte (no
 * agregado a `continuity-worker`) precisamente por eso -- forzar ESE
 * cron a correr cada 5 minutos habría significado sincronizar Gmail/
 * Calendar 288 veces al día por persona para un trabajo que solo
 * necesita frecuencia diaria (Memory/Goal/Project/Relationship/
 * Curiosidad, más los loops de `awaiting_my_reply`/`important_meeting`).
 *
 * Ventana de 15 minutos, cron cada 5 (`vercel.json`) -- un evento que
 * arranca en los próximos 15 minutos se ve en ~3 corridas antes de
 * empezar; la primera que lo encuentra manda el push, las siguientes lo
 * ven ya enviado (`sendPushNotification` ya deduplica por
 * `triggerType`+`sourceId`, mismo mecanismo que `continuity_loop` --
 * cero infraestructura nueva de dedupe). Preferible a intentar acertar
 * el minuto exacto: Vercel tampoco garantiza el minuto exacto de
 * disparo del cron en sí.
 *
 * Solo eventos con hora real (`!timing.isAllDay`) -- "tu evento de todo
 * el día empieza en 15 minutos" no tiene sentido (arranca a
 * medianoche). Eventos cancelados nunca cuentan.
 *
 * Costo real, documentado a propósito: a diferencia de
 * `continuity-worker` (una sincronización de Calendar por persona al
 * día), esto sincroniza Calendar en vivo por persona CONECTADA cada 5
 * minutos -- una llamada real a CalDAV por corrida, no cacheada.
 * Aceptable al volumen de usuarios de Alpha; si esto llega a pesar,
 * cachear el resultado de `getLiveCalendarContext` unos minutos sería
 * la optimización natural, no construida todavía porque no hace falta
 * aún.
 *
 * Límite conocido, aceptado a propósito (auditoría 2026-08-19):
 * `getLiveCalendarContext` reintenta la sincronización real incluso
 * para una conexión ya marcada `status: "error"` (correcto para
 * `/calendar`/`/dashboard` -- alguien mirando la página activamente sí
 * quiere que se reintente por si el error ya se resolvió), así que una
 * cuenta con credenciales rotas se reintenta 288 veces al día en vez de
 * una sola. Arreglarlo bien necesitaría backoff real (cuándo fue el
 * último intento) o que este cron duplicara el chequeo de estado antes
 * de llamar a la función compartida -- no vale la pena al volumen de
 * Alpha todavía; el `EXTERNAL_SYNC_TIMEOUT_MS` de arriba ya acota el
 * costo por intento aunque no evite el intento en sí.
 */
export const maxDuration = 30;

const TIME_BUDGET_MS = 25_000; // margen de seguridad sobre maxDuration=30s
const REMINDER_WINDOW_MS = 15 * 60 * 1000;
/**
 * `AppleCalendarClient.request()` no le pasa `signal`/timeout a su
 * propio `fetch` -- ver `core/observability/with-timeout.ts`. Más
 * corto que el de `continuity-worker` (12s) a propósito: este cron
 * corre cada 5 minutos con un presupuesto total de apenas 25s
 * compartido entre TODAS las personas conectadas, así que una sola
 * cuenta lenta no puede darse el lujo de acaparar casi todo el
 * presupuesto de la corrida.
 */
const EXTERNAL_SYNC_TIMEOUT_MS = 8_000;

function eventStart(event: CalendarEvent): Date {
  return event.timing.isAllDay ? new Date(`${event.timing.date}T00:00:00Z`) : event.timing.dateTime;
}

function isStartingSoon(event: CalendarEvent, now: Date): boolean {
  if (event.status === "cancelled" || event.timing.isAllDay) return false;
  const start = eventStart(event).getTime();
  return start > now.getTime() && start <= now.getTime() + REMINDER_WINDOW_MS;
}

export async function GET(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const requestId = createRequestId();
  const startedAt = Date.now();
  const now = new Date();

  const lifeGraphRepo = new DrizzleLifeGraphRepository(db);
  const contexts = await lifeGraphRepo.listAllContexts();

  // `checked` cuenta cada LifeGraph que de verdad se examinó (llegó a
  // pedir su `CalendarSnapshot`), sin importar si tenía algo próximo --
  // auditoría 2026-08-19: la versión original solo lo incrementaba
  // cuando SÍ había un evento por avisar, así que en la mayoría de
  // corridas (nadie con una reunión en los próximos 15 minutos, el caso
  // común) el log habría mostrado `checked: 0` para una corrida
  // perfectamente sana -- indistinguible de un cron roto sin revisar
  // logs mucho más a fondo.
  let checked = 0;
  let sent = 0;
  let failed = 0;

  for (const context of contexts) {
    if (Date.now() - startedAt >= TIME_BUDGET_MS) {
      break;
    }

    try {
      const calendarOutcome = await withTimeout(
        getLiveCalendarContext(db, context.lifeGraphId),
        EXTERNAL_SYNC_TIMEOUT_MS,
      );
      checked += 1;

      if (calendarOutcome === null) {
        logger.log({
          event: "cron.calendar_reminder_worker.sync_timeout",
          severity: "info",
          lifeGraphId: context.lifeGraphId,
        });
        continue;
      }
      if (calendarOutcome.status !== "connected") {
        continue;
      }

      const startingSoon = calendarOutcome.snapshot.upcoming.filter((event) => isStartingSoon(event, now));
      if (startingSoon.length === 0) {
        continue;
      }

      const userId = await resolveUserIdForLifeGraph(db, context.lifeGraphId);
      if (!userId) {
        continue;
      }

      for (const event of startingSoon) {
        await sendPushNotification(db, {
          userId,
          title: "Tu evento empieza pronto",
          body: event.title,
          triggerType: "calendar_starting_soon",
          sourceId: event.id,
        });
        sent += 1;
      }
    } catch (error) {
      failed += 1;
      await recordEvent(db, {
        type: "error",
        route: "cron.calendar_reminder_worker",
        message: error instanceof Error ? error.message : String(error),
        metadata: { lifeGraphId: context.lifeGraphId },
      });
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.log({
    event: "cron.calendar_reminder_worker.completed",
    requestId,
    route: ROUTE,
    checked,
    sent,
    failed,
    durationMs,
  });

  return NextResponse.json({ checked, sent, failed, durationMs });
}
