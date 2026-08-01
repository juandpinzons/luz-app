import type { ContinuityLoop, LoopClosureResult } from "../../../core/continuity-engine";
import type { CalendarEvent } from "../../reality/domain";
import type { Memory } from "../../../core/memory-engine";

/** Mismo duplicado deliberado que `../detection/detect-from-calendar.ts` -- ver su docblock. */
function eventEnd(event: CalendarEvent): Date {
  return event.timing.isAllDay ? new Date(`${event.timing.endDate}T00:00:00Z`) : event.timing.endDateTime;
}

/**
 * Ventana tras el fin del evento durante la cual una `Memory` nueva
 * cuenta como "el desenlace ya se registró" -- misión ejemplo "meeting
 * finished and outcome captured" exige DOS condiciones, no solo que el
 * tiempo pasó. 48h es conservador (cubre "lo comenté al día
 * siguiente"), documentado como una aproximación honesta: no hay forma
 * determinista (sin IA) de confirmar que una Memory específica
 * describe ESTE evento en particular, solo que algo se registró
 * después -- mismo tipo de limitación ya documentada en otras partes
 * de este repo (p. ej. `titlesLikelyMatch`, recuperación contextual sin
 * embeddings).
 */
const OUTCOME_CAPTURE_WINDOW_HOURS = 48;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Regla de cierre determinista para `CalendarEvent` -- misión ejemplos
 * "meeting finished and outcome captured" / "calendar event resolved".
 * Dos niveles, nunca uno solo:
 *
 * 1. El evento ya terminó (`eventEnd < now`) SIN memorias nuevas desde
 *    entonces -> evidencia `calendar_event_passed`, mueve el loop a
 *    `follow_up` (nunca lo cierra) -- LUZ debería preguntar "¿cómo te
 *    fue?", no asumir nada todavía. Esta función no produce este caso
 *    como `LoopClosureResult` (que exige un estado TERMINAL) -- lo
 *    señala vía el segundo valor de retorno, ver `CalendarClosureOutcome`.
 * 2. El evento terminó Y existe una `Memory` capturada dentro de
 *    `OUTCOME_CAPTURE_WINDOW_HOURS` después de su fin -> evidencia
 *    `calendar_event_outcome_captured`, cierra en `resolved` con
 *    desenlace `unknown` (honesto: hay señal de que algo se registró,
 *    no de si salió bien o mal, ver docblock de `LoopOutcomeKind`).
 */
export interface CalendarClosureOutcome {
  readonly result: LoopClosureResult | null;
  /** `true` cuando el evento ya pasó pero todavía no hay evidencia de desenlace -- el llamador debe transicionar a `follow_up`, no a un estado terminal. */
  readonly eventPassedAwaitingOutcome: boolean;
}

export function detectCalendarEventClosure(
  loop: ContinuityLoop,
  event: CalendarEvent,
  memoriesSinceEventEnded: readonly Memory[],
  now: Date = new Date(),
): CalendarClosureOutcome {
  if (loop.trigger.origin !== "calendar" || loop.trigger.sourceId !== event.id) {
    return { result: null, eventPassedAwaitingOutcome: false };
  }

  const end = eventEnd(event);
  if (end.getTime() > now.getTime()) {
    return { result: null, eventPassedAwaitingOutcome: false };
  }

  const captureDeadline = end.getTime() + OUTCOME_CAPTURE_WINDOW_HOURS * HOUR_MS;
  const outcomeMemory = memoriesSinceEventEnded.find(
    (memory) => memory.createdAt.getTime() >= end.getTime() && memory.createdAt.getTime() <= captureDeadline,
  );

  if (!outcomeMemory) {
    return { result: null, eventPassedAwaitingOutcome: true };
  }

  return {
    eventPassedAwaitingOutcome: false,
    result: {
      evidence: {
        kind: "calendar_event_outcome_captured",
        observedAt: now,
        description: `El evento "${event.title}" terminó y hay una memoria registrada después.`,
        sourceId: outcomeMemory.id,
      },
      toState: "resolved",
      outcome: { kind: "unknown", summary: `"${event.title}" ocurrió; se registró algo después, sin tono determinable.`, capturedAt: now },
    },
  };
}

/**
 * Conveniencia para cuando ya se sabe que el evento pasó y no hace
 * falta buscar memorias -- construye directamente la evidencia
 * `calendar_event_passed` que el llamador pasa a `transitionLoop(loop,
 * "follow_up", evidencia)`.
 *
 * Nota deliberada: no existe un `detectFromCalendarSnapshotClosure`
 * basado en `CalendarSnapshot` -- `CalendarSnapshot.today`/`upcoming`
 * son ventanas hacia ADELANTE (ver `features/reality/README.md`), un
 * evento ya pasado hace días simplemente no aparece ahí. El llamador
 * de `detectCalendarEventClosure` debe traer el `CalendarEvent`
 * específico desde la lista completa de eventos conocidos (p. ej.
 * `RefreshCalendarResult.events`), nunca derivarlo de un snapshot que
 * no está diseñado para contener historial.
 */
export function calendarEventPassedEvidence(event: CalendarEvent, now: Date = new Date()) {
  return {
    kind: "calendar_event_passed" as const,
    observedAt: now,
    description: `El evento "${event.title}" ya terminó -- pendiente de que LUZ pregunte cómo salió.`,
    sourceId: event.id,
  };
}
