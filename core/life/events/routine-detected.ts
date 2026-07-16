import type { EntityId } from "../value-objects/entity-id";
import type { RoutineFrequency } from "../value-objects/routine-frequency";
import type { DomainEvent } from "./domain-event";

/**
 * Emitido cuando el sistema detecta un patrón recurrente de
 * comportamiento, no cuando el usuario declara un `Habit`.
 */
export interface RoutineDetectedPayload {
  routineId: EntityId;
  title: string;
  frequency: RoutineFrequency;
  /** Hábito declarado que coincide con el patrón, si existe. */
  matchedHabitId?: EntityId;
}

export type RoutineDetected = DomainEvent<
  "life.routine_detected",
  RoutineDetectedPayload
>;
