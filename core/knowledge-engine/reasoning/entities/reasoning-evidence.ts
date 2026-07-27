import type { EntityId } from "../../../life/value-objects/entity-id";

export const REASONING_EVIDENCE_ROLES = ["supporting", "contradicting"] as const;
export type ReasoningEvidenceRole = (typeof REASONING_EVIDENCE_ROLES)[number];

/**
 * Referencia neutral y polimórfica a lo que participó en un
 * razonamiento -- mismo criterio que `ContradictionRef`
 * (`core/contradiction-engine`): `refType` es texto libre, sin FK
 * real, para no cerrar la puerta a evidencia de tipos que el Reasoning
 * Engine todavía no consume directamente (`belief`, `concept` --
 * compatibilidad futura explícita, ver docblock de la tabla en el
 * schema). Hoy siempre `"insight"` o `"memory"`.
 */
export interface ReasoningEvidenceRef {
  refType: string;
  refId: EntityId;
  role: ReasoningEvidenceRole;
}

/**
 * Fila persistida de evidencia -- `ReasoningEvidenceRef` más identidad
 * propia y pertenencia a una conclusión concreta, mismo patrón que
 * `Evidence`/`ConceptEvidence`/`BeliefEvidence`.
 */
export interface ReasoningEvidence {
  id: EntityId;
  lifeGraphId: EntityId;
  conclusionId: EntityId;
  ref: ReasoningEvidenceRef;
  createdAt: Date;
}
