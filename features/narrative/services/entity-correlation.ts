import type { HomeState } from "../../home/domain/home-state";
import type { CalendarEvent, CalendarSnapshot } from "../../reality/domain";
import type { NarrativeRelatedEntity } from "../domain/narrative-related-entity";
import { hoursBetween } from "./time-math";

/**
 * Identidad estable de una entidad real -- mismo criterio (`${kind}:${id}`)
 * que `entityKey()` en `features/experience/services/collect-candidates.ts`,
 * redefinido aquí porque esa función es privada de `features/experience/`
 * y porque `LoopRelatedEntity` (a diferencia de `ObservationEntityRef`)
 * siempre trae `id`, incluso para `kind: "domain"` -- una sola forma
 * basta para las doce variantes de `LoopRelatedEntityKind`. Ningún
 * `ContinuityLoop` real produce hoy una entidad `kind: "domain"`
 * (verificado contra `core/continuity-engine/detection/`), así que este
 * caso queda cubierto por construcción del tipo, no ejercitado en la
 * práctica todavía.
 */
export function relatedEntityKey(entity: NarrativeRelatedEntity): string {
  return `${entity.kind}:${entity.id}`;
}

/**
 * Claves de entidad que Presence/Home YA decidieron que merecen el foco
 * de la persona ahora mismo (`HomeState.currentFocus`) -- señal "user
 * attention" del ranking (`services/narrative-score.ts`). Narrative
 * nunca vuelve a decidir esto por su cuenta, solo lo reusa (mismo
 * principio de "una decisión, un solo lugar" que ya aplica en todo el
 * resto del repo). `PresenceFocusItem.entities` es `ObservationEntityRef[]`,
 * cuya variante `domain` no trae `id` -- se normaliza aquí a la MISMA
 * convención `domain:${domain}` que usa `entityKey()` en Experience, para
 * que un futuro `LoopRelatedEntity` de `kind: "domain"` (si alguna vez
 * existe) pueda correlacionar contra esto sin cambios.
 */
export function buildAttentionEntityKeys(homeState: HomeState): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const focus of [homeState.currentFocus.primary, homeState.currentFocus.secondary]) {
    if (!focus) continue;
    for (const entity of focus.entities) {
      keys.add(entity.kind === "domain" ? `domain:${entity.domain}` : `${entity.kind}:${entity.id}`);
    }
  }
  return keys;
}

function eventStart(event: CalendarEvent): Date {
  return event.timing.isAllDay ? new Date(event.timing.date) : event.timing.dateTime;
}

/**
 * Un `ContinuityLoop` originado en calendario guarda el `ExternalEventId`
 * real en `trigger.sourceId` (ver docblock de `LoopTrigger`,
 * `core/continuity-engine/domain/continuity-loop.ts`) -- correlación
 * EXACTA por igualdad de id, nunca aproximada por título/fecha. `null`
 * cuando no hay `CalendarSnapshot` o el evento ya no aparece en
 * `today`/`upcoming` (pudo cancelarse o salir de la ventana sincronizada
 * -- ausencia real, nunca tratada como error).
 */
export function findCorrelatedCalendarEvent(
  calendar: CalendarSnapshot | null,
  sourceId: string,
): CalendarEvent | null {
  if (!calendar) return null;
  return [...calendar.today, ...calendar.upcoming].find((event) => event.id === sourceId) ?? null;
}

/** Puede ser negativo (el evento ya empezó/pasó) -- quien llama decide si eso todavía cuenta como "próximo". */
export function hoursUntilEventStart(event: CalendarEvent, now: Date): number {
  return hoursBetween(now, eventStart(event));
}
