import type { DetectedLoopCandidate } from "../../../core/continuity-engine";
import type { CalendarEvent, CalendarSnapshot } from "../../reality/domain";

/**
 * Extrae el inicio real de un `CalendarEvent` -- duplicado deliberado
 * de la lógica interna de `features/reality/application/calendar-
 * timing-helpers.ts` (`eventStart`, NO exportada desde `features/
 * reality/index.ts` a propósito, ver su propio docblock: "detalle de
 * implementación de este módulo, no parte de la superficie pública").
 * Mismo criterio ya usado en Memory Engine (`select-contextual-
 * memories.ts`) para un heurístico pequeño: duplicar 3 líneas es más
 * seguro que importar un detalle interno de otro módulo a través de su
 * frontera pública.
 */
function eventStart(event: CalendarEvent): Date {
  return event.timing.isAllDay ? new Date(`${event.timing.date}T00:00:00Z`) : event.timing.dateTime;
}

/**
 * Regla de apertura determinista para `CalendarEvent` -- misión
 * ejemplos "future commitment" / "important meeting". Vive en
 * `features/continuity/`, no en `core/continuity-engine/`, porque
 * Calendar Foundation es un módulo `features/` (`features/reality/`) --
 * `core/` nunca depende de `features/` (ver `core/continuity-engine/
 * README.md`).
 *
 * `attendees.length > 0` (alguien más además de la propia cuenta) ->
 * `important_meeting` (prioridad `high`, es un compromiso con otra
 * persona real). Sin asistentes adicionales -> `future_commitment`
 * (prioridad `medium`). Solo eventos futuros -- uno ya pasado es
 * responsabilidad de una regla de CIERRE (`./detect-calendar-
 * closure.ts` en `../resolution/`), nunca de apertura.
 */
export function detectFromCalendarEvent(event: CalendarEvent, now: Date = new Date()): DetectedLoopCandidate | null {
  if (event.status === "cancelled") return null;

  const start = eventStart(event);
  if (start.getTime() <= now.getTime()) return null;

  const isMeeting = event.attendees.length > 0;

  return {
    trigger: {
      origin: "calendar",
      reason: isMeeting ? "important_meeting" : "future_commitment",
      sourceId: event.id,
      detectedAt: now,
      summary: event.title,
    },
    title: event.title,
    priority: isMeeting ? "high" : "medium",
    relatedEntities: [{ kind: "calendar_event", id: event.id, title: event.title }],
  };
}

/** Corre `detectFromCalendarEvent` sobre `CalendarSnapshot.upcoming` -- ya filtrado a la ventana relevante por Calendar Foundation, nunca se reimplementa ese filtro aquí. */
export function detectFromCalendarSnapshot(
  snapshot: CalendarSnapshot,
  now: Date = new Date(),
): DetectedLoopCandidate[] {
  const candidates: DetectedLoopCandidate[] = [];
  for (const event of snapshot.upcoming) {
    const candidate = detectFromCalendarEvent(event, now);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}
