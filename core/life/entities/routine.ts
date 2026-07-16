import type { EntityId } from "../value-objects/entity-id";
import type { LifeDomainType } from "../value-objects/life-domain-type";
import type { RoutineFrequency } from "../value-objects/routine-frequency";

/**
 * Patrón de comportamiento detectado por el sistema (ver evento
 * `RoutineDetected`), a diferencia de `Habit`, que el usuario declara.
 * `habitId` queda poblado si el usuario confirma que la rutina detectada
 * corresponde a un hábito ya declarado.
 */
export interface Routine {
  id: EntityId;
  lifeGraphId: EntityId;
  habitId?: EntityId;
  title: string;
  frequency: RoutineFrequency;
  domain?: LifeDomainType;
  detectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
