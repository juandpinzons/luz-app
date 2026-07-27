import type { EntityId } from "../../life/value-objects/entity-id";
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";
import type { MovementDirection } from "./domain-movement";

/**
 * "Cuando [fromDomain] [fromDirection], [toDomain] tiende a
 * [toDirection] poco después" -- observado `occurrences` veces
 * separadas, nunca inferido de una sola coincidencia. `sampleBeliefIds`
 * lleva un Belief real de cada lado (el más reciente que participó) para
 * que quien persista el patrón como Insight pueda citar evidencia real,
 * nunca inventada.
 */
export interface PredictivePatternCandidate {
  fromDomain: LifeDomainType;
  fromDirection: MovementDirection;
  toDomain: LifeDomainType;
  toDirection: MovementDirection;
  occurrences: number;
  lastObservedAt: Date;
  sampleFromBeliefId: EntityId;
  sampleToBeliefId: EntityId;
}
