import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";

/**
 * Última etapa del lifecycle. A diferencia de Archive, forget no
 * devuelve la memoria — el contrato deja abierto si la implementación
 * borra la fila o solo marca `status: "forgotten"`, esa es una
 * decisión de persistencia, no de dominio.
 */
export interface ForgetStage {
  forget(context: LifeGraphContext, memoryId: EntityId): Promise<void>;
}
