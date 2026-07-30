import type { LifeObservation } from "../../dashboard/services/build-life-observations";
import type { PresenceFocusItem } from "../domain/presence-state";
import { buildFocusItem } from "./build-focus-item";
import { rankObservations } from "./rank-observations";

export interface PresenceFocus {
  primaryFocus: PresenceFocusItem | null;
  secondaryFocus: PresenceFocusItem | null;
}

/** Las dos observaciones de mayor prioridad, proyectadas a `PresenceFocusItem` -- `null` cuando no hay suficientes, nunca un relleno inventado. */
export function pickFocus(observations: LifeObservation[]): PresenceFocus {
  const [primary, secondary] = rankObservations(observations);
  return {
    primaryFocus: primary ? buildFocusItem(primary) : null,
    secondaryFocus: secondary ? buildFocusItem(secondary) : null,
  };
}
