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
