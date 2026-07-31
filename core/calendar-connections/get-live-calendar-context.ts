import type { EntityId } from "../life/value-objects/entity-id";
import type { Database } from "../db/client";
import { buildCalendarContext } from "../../features/home/services/build-calendar-context";
import type { HomeCalendarContext } from "../../features/home/domain/home-state";
import { applySyncResult, getCalendarSnapshot, synchronizeCalendar } from "../../features/reality/application";
import { AppleCalendarClient, AppleCalendarProvider } from "../../features/reality/providers/apple";
import {
  getStoredCalendarConnection,
  markCalendarConnectionError,
  markCalendarConnectionSynced,
} from "./repository";

/**
 * Único lugar que sabe hacer "conexión guardada -> sync en vivo ->
 * HomeCalendarContext" -- antes vivía inline dentro de
 * `app/calendar/page.tsx`; ahora también lo usa
 * `app/dashboard/page.tsx` (Misión "conéctalo al dashboard
 * principal"). Un solo lugar decide la ventana de sync y qué hacer
 * ante un fallo, para que las dos pantallas nunca puedan divergir en
 * ese criterio.
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
  | { status: "connected"; externalAccountId: string; calendarContext: HomeCalendarContext }
  | { status: "error"; externalAccountId: string; error: unknown };

export async function getLiveCalendarContext(db: Database, lifeGraphId: EntityId): Promise<LiveCalendarOutcome> {
  const stored = await getStoredCalendarConnection(db, lifeGraphId, "apple");

  if (!stored || stored.connection.status === "disconnected") {
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
    };
  } catch (error) {
    await markCalendarConnectionError(db, stored.connection.id);
    return { status: "error", externalAccountId: stored.connection.externalAccountId, error };
  }
}
