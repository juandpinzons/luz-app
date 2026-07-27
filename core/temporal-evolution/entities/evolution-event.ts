import type { EntityId } from "../../life/value-objects/entity-id";
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";

export const EVOLUTION_EVENT_KINDS = [
  "belief_created",
  "belief_strengthened",
  "belief_weakened",
  "belief_expired",
  "belief_retracted",
  "insight_discovered",
] as const;
export type EvolutionEventKind = (typeof EVOLUTION_EVENT_KINDS)[number];

/**
 * Un punto en la evolución de la persona -- nunca un snapshot serializado
 * (Principio 6: `RealitySnapshot` no es un log; esto tampoco lo es,
 * se DERIVA en cada consulta de `belief_history`/`knowledge_engine_insights`
 * ya persistidos, nunca se guarda aparte). `refId` apunta al Belief o
 * Insight real detrás del evento, para que quien lo muestre pueda
 * enlazar a la evidencia completa.
 */
export interface EvolutionEvent {
  kind: EvolutionEventKind;
  refType: "belief" | "insight";
  refId: EntityId;
  domain?: LifeDomainType;
  description: string;
  occurredAt: Date;
}
