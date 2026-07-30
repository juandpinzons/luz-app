import type { LifeObservation, ObservationPriority } from "../../dashboard/services/build-life-observations";

const PRIORITY_RANK: Record<ObservationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * `buildLifeObservations` ya entrega el arreglo ordenado por prioridad,
 * pero esta capa no depende de ese detalle de implementación de otro
 * módulo -- reordena explícitamente aquí (orden estable: mismo orden
 * relativo a igual prioridad).
 */
export function rankObservations(observations: LifeObservation[]): LifeObservation[] {
  return [...observations].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
}
