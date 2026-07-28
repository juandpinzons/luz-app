import type { EntityId } from "../../life/value-objects/entity-id";
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";
import type { MovementDirection } from "./domain-movement";

/**
 * Un `PredictivePatternCandidate` ya confirmado (>=2 ocurrencias) cuyo
 * lado "gatillo" (`fromDomain`/`fromDirection`) se observó de nuevo
 * hace poco, sin que el lado "consecuencia" se haya observado todavía
 * después de ese gatillo -- la diferencia real entre describir una
 * correlación pasada (`PredictivePatternCandidate`) y anticipar algo
 * que todavía no pasó. `triggeredAt` es la fecha del movimiento que
 * disparó esta predicción, no la del patrón original.
 */
export interface PendingPrediction {
  fromDomain: LifeDomainType;
  fromDirection: MovementDirection;
  toDomain: LifeDomainType;
  toDirection: MovementDirection;
  occurrences: number;
  triggeredAt: Date;
  sampleFromBeliefId: EntityId;
}
