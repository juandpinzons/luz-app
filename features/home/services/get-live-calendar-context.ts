import type { EntityId } from "../../../core/life/value-objects/entity-id";
import type { Database } from "../../../core/db/client";
import { buildCalendarContext } from "./build-calendar-context";
import type { HomeCalendarContext } from "../domain/home-state";
import type { CalendarSnapshot } from "../../reality/domain";
import { applySyncResult, getCalendarSnapshot, synchronizeCalendar } from "../../reality/application";
import { AppleCalendarClient, AppleCalendarProvider } from "../../reality/providers/apple";
import {
  getStoredCalendarConnection,
  markCalendarConnectionError,
  markCalendarConnectionSynced,
} from "../../../core/calendar-connections/repository";

/**
 * Único lugar que sabe hacer "conexión guardada -> sync en vivo ->
 * HomeCalendarContext" -- lo usan `app/calendar/page.tsx`,
 * `app/dashboard/page.tsx`, y `features/chat/services/get-calendar-signals-for-conversation.ts`.
 * Un solo lugar decide la ventana de sync y qué hacer ante un fallo,
 * para que ninguno de los tres pueda divergir en ese criterio.
 *
 * Vive en `features/home/services/`, no en `core/calendar-connections/`
 * (auditoría de arquitectura, 2026-08-15): construye
 * `AppleCalendarClient`/`AppleCalendarProvider` y llama
 * `synchronizeCalendar` directamente, así que no puede ser una capa de
 * persistencia pura -- `core/calendar-connections/repository.ts` sigue
 * siendo esa capa, esta función la consume, nunca al revés. También
 * llama `buildCalendarContext` (`features/home/`), lo que habría creado
 * un nuevo borde `reality -> home` si esta función hubiera quedado
 * dentro de `features/reality/` -- Reality declara explícitamente "sin
 * dependencias cruzadas hacia otras features de LUZ" (`features/reality/README.md`),
 * así que el destino correcto es `features/home/`, que ya depende de
 * `features/reality/domain` y ya es dueño del traductor puro
 * (`build-calendar-context.ts`).
 *
 * Nunca lanza -- cada estado real (sin conectar / sincronizado / error)
 * es un valor devuelto, mismo criterio de tolerancia a fallos que el
 * resto de `app/dashboard/page.tsx` ya usa para brief/summary/goals.
 * Quien llama decide si además quiere loguear con su propio
 * `requestId`/`route` (`app/calendar/page.tsx` y
 * `app/dashboard/page.tsx` lo hacen distinto, a propósito).
 */

const SYNC_WINDOW_DAYS_BACK = 3;
const SYNC_WINDOW_DAYS_FORWARD = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * LUZ es un producto pensado para Colombia (mismo criterio que
 * `build-morning-brief.ts`) -- sin esto, `getCalendarSnapshot` calcula
 * "hoy" en fronteras de día UTC puro, y un evento de la noche/tarde en
 * Bogotá puede clasificarse en el día UTC equivocado (ver
 * `features/reality/README.md`, "Timezone real de la persona";
 * `features/home/README.md`, hallazgo #3). Único punto que necesita
 * este cambio: `getCalendarSnapshot` sigue siendo UTC por defecto para
 * cualquier otro llamador (p. ej. los fixtures que documentan a
 * propósito el límite sin este parámetro).
 */
const PERSON_TIME_ZONE = "America/Bogota";

export type LiveCalendarOutcome =
  | { status: "not_connected" }
  | {
      status: "connected";
      externalAccountId: string;
      calendarContext: HomeCalendarContext;
      /** El `CalendarSnapshot` crudo detrás de `calendarContext` -- `app/api/cron/continuity-worker/route.ts` lo necesita para `detectAllContinuityLoops`, que espera el dominio de Reality, no la forma ya traducida para Home. Aditivo: quien solo lea `calendarContext` no nota el cambio. */
      snapshot: CalendarSnapshot;
    }
  | { status: "error"; externalAccountId: string; error: unknown };

export async function getLiveCalendarContext(db: Database, lifeGraphId: EntityId): Promise<LiveCalendarOutcome> {
  const stored = await getStoredCalendarConnection(db, lifeGraphId, "apple");

  // La segunda condición es redundante en el camino feliz (una conexión
  // `disconnected` siempre tiene `credentials: null`, ver
  // `disconnectStoredCalendarConnection`) -- se deja explícita para que
  // TypeScript angoste `stored.credentials` a no-null de aquí en
  // adelante, sin un cast.
  if (!stored || stored.connection.status === "disconnected" || !stored.credentials) {
    return { status: "not_connected" };
  }

  try {
    const provider = new AppleCalendarProvider(new AppleCalendarClient(stored.credentials));
    const now = new Date();
    const window = {
      from: new Date(now.getTime() - SYNC_WINDOW_DAYS_BACK * DAY_MS),
      to: new Date(now.getTime() + SYNC_WINDOW_DAYS_FORWARD * DAY_MS),
    };

    const syncResult = await synchronizeCalendar(provider, stored.connection, null, { window });
    const events = applySyncResult([], syncResult.upserted, syncResult.deleted);
    const snapshot = getCalendarSnapshot(events, syncResult.connection, {
      now,
      upcomingWindowDays: SYNC_WINDOW_DAYS_FORWARD,
      timeZone: PERSON_TIME_ZONE,
    });

    await markCalendarConnectionSynced(db, stored.connection.id);

    // `buildCalendarContext` solo devuelve `null` cuando recibe `null` -- `snapshot` aquí siempre existe.
    return {
      status: "connected",
      externalAccountId: stored.connection.externalAccountId,
      calendarContext: buildCalendarContext(snapshot)!,
      snapshot,
    };
  } catch (error) {
    await markCalendarConnectionError(db, stored.connection.id);
    return { status: "error", externalAccountId: stored.connection.externalAccountId, error };
  }
}
