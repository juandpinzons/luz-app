import type { HomeCalendarContext } from "../../home/domain/home-state";
import type { OrbMoment, OrbTimeOfDay } from "../domain/orb-state";

const BOGOTA_TIME_ZONE = "America/Bogota";

const HOUR_FORMAT = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: BOGOTA_TIME_ZONE,
});

/** Mismos cortes que `timeOfDayBucket`/`buildGreeting` (`generate-welcome.ts`/`features/presence/services/build-greeting.ts`) -- nunca un segundo umbral inventado aparte, para que "de madrugada" signifique lo mismo en cualquier parte de LUZ. */
function timeOfDay(now: Date): OrbTimeOfDay {
  const hour = Number(HOUR_FORMAT.format(now));
  if (hour < 5) return "dawn";
  if (hour < 12) return "morning";
  if (hour < 19) return "afternoon";
  return "night";
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Una memoria capturada dentro de esta ventana cuenta como "justo después de una conversación con contenido real" -- más allá de esto, ya es historia, no un eco del momento. */
const MEANINGFUL_CONVERSATION_WINDOW_MS = 20 * HOUR_MS;
/** A partir de cuántos días sin mensajes el silencio real empieza a pedir una luz más suave -- mismo orden de magnitud que `RETURNING_GAP_DAYS` (`app/dashboard/page.tsx`), pero un umbral propio: el orbe y el saludo de regreso responden preguntas distintas. */
const QUIET_DAYS_THRESHOLD_MS = 4 * DAY_MS;
/** Un Goal/Project marcado `completed` dentro de esta ventana todavía se siente como un logro reciente, no un dato histórico más. */
const RECENT_COMPLETION_WINDOW_MS = 3 * DAY_MS;
/** Una Relationship actualizada dentro de esta ventana es un reencuentro real y reciente, no solo que exista un registro. */
const RECENT_RECONNECTION_WINDOW_MS = 3 * DAY_MS;

function isWithin(at: Date | null | undefined, now: Date, windowMs: number): boolean {
  if (!at) return false;
  const delta = now.getTime() - at.getTime();
  return delta >= 0 && delta <= windowMs;
}

/**
 * "Reunión importante hoy" -- reusa `meetingMoments` que Calendar
 * Foundation (vía `features/home/services/build-calendar-context.ts`)
 * ya categorizó por cercanía real a "ahora" (`starting_soon`/
 * `in_progress`); nunca un segundo cálculo de ventana de tiempo sobre
 * el calendario.
 */
function hasImportantMeetingSoon(calendar: HomeCalendarContext | null): boolean {
  if (!calendar) return false;
  return calendar.meetingMoments.some(
    (moment) => moment.kind === "starting_soon" || moment.kind === "in_progress",
  );
}

export interface OrbMomentInputs {
  now: Date;
  /** `RealitySnapshot.memory.items[0]?.occurredAt` -- la memoria real más reciente, si hay alguna. */
  mostRecentMemoryAt: Date | null;
  /** Mismo dato que ya recibe `generateWelcome` (`GenerateWelcomeInput`) -- nunca una segunda forma de calcular esto. */
  msSinceLastMessage: number | null;
  calendar: HomeCalendarContext | null;
  /** El más reciente entre goals/projects que pasaron a `completed`, si hay alguno. */
  mostRecentCompletionAt: Date | null;
  /** El más reciente `updatedAt` entre las relaciones de esta persona, si hay alguna. */
  mostRecentRelationshipTouchAt: Date | null;
}

/**
 * "Emoción a través de la realidad" (Objetivo B) -- cada campo de
 * `OrbMoment` se deriva de UN hecho verificable, nunca de una
 * combinación interpretada ni de una inferencia sobre cómo se siente
 * la persona. Determinístico: mismas entradas, siempre el mismo
 * resultado -- nunca aleatorio, nunca depende de la hora en que corre
 * el servidor más que a través de `now`.
 */
export function deriveOrbMoment(inputs: OrbMomentInputs): OrbMoment {
  const hasBeenQuiet =
    inputs.msSinceLastMessage !== null && inputs.msSinceLastMessage >= QUIET_DAYS_THRESHOLD_MS;

  return {
    timeOfDay: timeOfDay(inputs.now),
    hadMeaningfulConversationRecently: isWithin(
      inputs.mostRecentMemoryAt,
      inputs.now,
      MEANINGFUL_CONVERSATION_WINDOW_MS,
    ),
    hasBeenQuiet,
    hasImportantMeetingSoon: hasImportantMeetingSoon(inputs.calendar),
    completedSomethingRecently: isWithin(
      inputs.mostRecentCompletionAt,
      inputs.now,
      RECENT_COMPLETION_WINDOW_MS,
    ),
    reconnectedRecently: isWithin(
      inputs.mostRecentRelationshipTouchAt,
      inputs.now,
      RECENT_RECONNECTION_WINDOW_MS,
    ),
  };
}
