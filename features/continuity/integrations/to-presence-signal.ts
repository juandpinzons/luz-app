import type { ContinuityLoop, LoopPriority } from "../../../core/continuity-engine";
import type { PresenceUrgencyLevel } from "../../presence/domain/presence-state";

/** `LoopPriority` y `PresenceUrgencyLevel` son la misma unión de valores por diseño (ver `core/continuity-engine/domain/loop-priority.ts`) -- reasignación directa, nunca una tabla de conversión. */
function toUrgency(priority: LoopPriority): PresenceUrgencyLevel {
  return priority;
}

/**
 * Un loop, proyectado como señal de urgencia para la Capa de Presencia
 * -- misión: "Expose clean contracts for... Presence." Tipo propio de
 * Continuity (no `PresenceFocusItem`, que exige `LifeObservationType`/
 * `ObservationEntityRef[]`, vocabulario que pertenece a `LifeObservation`
 * -- forzar un loop en esa forma inventaría una observación que nunca
 * existió). Un futuro `buildPresenceState` puede leer esto junto a
 * `LifeObservation[]` y decidir cómo fusionarlos, sin que este módulo
 * presuma esa decisión.
 */
export interface ContinuityPresenceSignal {
  readonly loopId: string;
  readonly title: string;
  readonly urgency: PresenceUrgencyLevel;
}

/** Ordenado por urgencia descendente (`critical` primero) -- listo para que un consumidor tome el primero como "foco principal" sin volver a ordenar. */
export function toPresenceSignals(loops: readonly ContinuityLoop[]): ContinuityPresenceSignal[] {
  const rank: Readonly<Record<PresenceUrgencyLevel, number>> = { critical: 0, high: 1, medium: 2, low: 3 };

  return loops
    .map((loop) => ({ loopId: loop.id, title: loop.title, urgency: toUrgency(loop.priority) }))
    .sort((a, b) => rank[a.urgency] - rank[b.urgency]);
}
