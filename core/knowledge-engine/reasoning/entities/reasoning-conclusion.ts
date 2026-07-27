import type { EntityId } from "../../../life/value-objects/entity-id";
import type { Confidence } from "../../value-objects/confidence";

export const REASONING_CONCLUSION_STATUSES = ["validated", "invalidated"] as const;
export type ReasoningConclusionStatus = (typeof REASONING_CONCLUSION_STATUSES)[number];

/**
 * El siguiente nivel sobre `Insight` -- un Insight interpreta UNA
 * pieza de evidencia ("qué significa esto"); un `ReasoningConclusion`
 * combina VARIOS insights ya validados y correlacionados entre sí para
 * concluir algo que ninguno dice por sí solo ("qué sigue de lo que ya
 * sé"). Propio aggregate, igual que `Insight`: opera sobre un
 * LifeGraph, nunca es miembro del aggregate `LifeGraph` (ADR-0011).
 * `confidence` nunca es opcional -- mismo criterio que `Insight`, solo
 * existe una vez que Validate decidió. `uncertaintyNotes` es un campo
 * de primera clase, no un adorno: toda conclusión declara
 * explícitamente qué no puede respaldar todavía, incluso cuando la
 * lista queda vacía (ver `default-reasoning-validation-strategy.ts`,
 * que siempre añade al menos la nota determinista sobre el tamaño del
 * cluster de evidencia).
 */
export interface ReasoningConclusion {
  id: EntityId;
  lifeGraphId: EntityId;
  statement: string;
  confidence: Confidence;
  status: ReasoningConclusionStatus;
  uncertaintyNotes: string[];
  createdAt: Date;
  updatedAt: Date;
}
