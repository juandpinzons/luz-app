import type { EntityId } from "../life/value-objects/entity-id";
import type { LifeDomainType } from "../life/value-objects/life-domain-type";

/**
 * Proyección mínima de una `CuriosityQuestion` (`core/curiosity-engine`)
 * -- mismo criterio que `RealityReasoningConclusion`: `core/reality` no
 * importa el tipo real, solo lo que `ConversationStrategyEngine`
 * necesita para decidir y para redactar el directive (la pregunta ya
 * escrita), no el ciclo de vida completo (eso vive en
 * `curiosity_questions`, para quien lo explore explícitamente).
 */
export interface RealityCuriosityQuestion {
  id: EntityId;
  domain: LifeDomainType;
  question: string;
}

/** La curiosidad pendiente de LUZ ahora mismo -- `null` si no hay ninguna (ausencia real, nunca inventada). */
export interface CuriosityContextSnapshot {
  pendingQuestion: RealityCuriosityQuestion | null;
}
