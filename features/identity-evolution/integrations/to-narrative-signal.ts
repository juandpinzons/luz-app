import type { EntityId } from "../../../core/life/value-objects/entity-id";
import type { IdentityTrajectoryState } from "../domain/identity-trajectory";
import type { IdentitySnapshot } from "../domain/identity-snapshot";

export interface IdentityNarrativeSignal {
  readonly primaryThemeKey: EntityId | null;
  readonly recurringThemeKeys: readonly string[];
  readonly resolvedChapterKeys: readonly string[];
  readonly trajectoryState: IdentityTrajectoryState;
}

/**
 * `IdentitySnapshot` -> señal para `features/narrative/` -- misión: la
 * capa Narrativa es uno de los cuatro consumidores explícitos.
 * Deliberadamente en el sentido opuesto a como `features/narrative` ya
 * consume otros módulos (Continuity, Home, Experience): aquí Identity
 * Evolution es quien produce la señal, Narrative sería quien la
 * consumiría -- ninguno de los dos módulos importa al otro todavía
 * (verificado: cero import cruzado). Un futuro
 * `NarrativeArc`/`selectPrimaryNarrative` podría usar
 * `resolvedChapterKeys` para preferir NO resucitar un arco cuya
 * identidad ya está clasificada `dormant` desde hace tiempo, sin que
 * Narrative tenga que reimplementar su propio cálculo de momentum.
 */
export function toIdentityNarrativeSignal(snapshot: IdentitySnapshot): IdentityNarrativeSignal {
  return {
    primaryThemeKey: snapshot.narrativeGuidance.primaryThemeKey,
    recurringThemeKeys: snapshot.narrativeGuidance.recurringThemeKeys,
    resolvedChapterKeys: snapshot.narrativeGuidance.resolvedChapterKeys,
    trajectoryState: snapshot.trajectory.state,
  };
}
