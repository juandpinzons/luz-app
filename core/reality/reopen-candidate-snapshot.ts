import type { EntityId } from "../life/value-objects/entity-id";

/**
 * Una intención sin resolver que la persona mencionó antes -- Memory
 * `type: "intention"`, ya filtrada por la capa de aplicación contra
 * `seen_prompts` (`subjectType: "intention_followup"`) para no
 * retomar la misma dos veces. `ReopenStrategyRule` (redesign del
 * pipeline conversacional, Beta) la usa exclusivamente al reabrir una
 * conversación nueva -- nunca a mitad de una en curso.
 */
export interface RealityReopenCandidate {
  id: EntityId;
  statement: string;
}

/** Como máximo una a la vez -- mismo criterio que `GrowingBeliefSnapshot`. */
export interface ReopenCandidateSnapshot {
  items: RealityReopenCandidate[];
}
