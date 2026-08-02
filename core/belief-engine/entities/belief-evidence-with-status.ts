import type { EntityId } from "../../life/value-objects/entity-id";
import type { BeliefStatus } from "./belief";

/**
 * Proyección de `BeliefEvidence` + el `status` del Belief al que
 * respalda -- pensada para un consumidor que necesita "¿esta
 * memoria/insight sigue sosteniendo algo que la persona cree hoy?",
 * nunca la evidencia completa. `memoryId`/`insightId` mutuamente no
 * excluyentes en el tipo (igual que `BeliefEvidence`), pero en la
 * práctica cada fila trae solo uno de los dos.
 */
export interface BeliefEvidenceWithStatus {
  memoryId: EntityId | null;
  insightId: EntityId | null;
  beliefStatus: BeliefStatus;
}
