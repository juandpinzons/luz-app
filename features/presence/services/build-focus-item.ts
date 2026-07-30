import type { LifeObservation } from "../../dashboard/services/build-life-observations";
import type { PresenceFocusItem } from "../domain/presence-state";

/** Proyecta una `LifeObservation` a la forma pública `PresenceFocusItem` -- ver el porqué en `domain/presence-state.ts`. */
export function buildFocusItem(observation: LifeObservation): PresenceFocusItem {
  return {
    type: observation.type,
    priority: observation.priority,
    domain: observation.domain,
    title: observation.entities[0]?.title ?? observation.explanation,
    explanation: observation.explanation,
    entities: observation.entities,
  };
}
