import type { NarrativeEcho } from "../domain/narrative-arc";
import type { NarrativeState } from "../domain/narrative-state";

export interface NarrativeMorningBriefContext {
  readonly primaryTitle: string | null;
  readonly primarySummary: string | null;
  /** `true` cuando `currentActiveStory` es un segundo intento tras un revés real -- el tipo de hecho que vale la pena redactar con cuidado (Principio 7), nunca inferido por Morning Brief por su cuenta. */
  readonly primaryIsReturningAfterSetback: boolean;
  /** Presente cuando hoy coincide con la fecha de un capítulo pasado del arco activo (Principio 8) -- datos crudos, `intervalMonths` incluido, nunca una frase ya armada. */
  readonly primaryEcho: NarrativeEcho | null;
  readonly celebrationTitles: readonly string[];
  readonly recentlyClosedTitles: readonly string[];
  /** Títulos de arcos `dormant` -- candidatos honestos a "¿sigue siendo esto algo que quieres?" (Principio 11: nunca framing de fracaso). */
  readonly dormantArcTitles: readonly string[];
}

/**
 * Datos crudos, NUNCA prosa -- `build-morning-brief.ts`
 * (`features/dashboard/`) sigue siendo el único lugar que llama a un
 * `AIProvider` en todo `features/dashboard/`; este contrato solo le
 * entrega hechos ya reales y ya priorizados, la redacción sigue siendo
 * su responsabilidad exclusiva. Mismo criterio que
 * `buildMorningBriefItems` (`features/continuity/integrations/`).
 * Ningún llamador real hoy.
 */
export function toMorningBriefContext(state: NarrativeState): NarrativeMorningBriefContext {
  return {
    primaryTitle: state.currentActiveStory?.current.title ?? null,
    primarySummary: state.currentActiveStory?.current.summary ?? null,
    primaryIsReturningAfterSetback: state.currentActiveStory?.isReturningAfterSetback ?? false,
    primaryEcho: state.currentActiveStory?.echo ?? null,
    celebrationTitles: state.celebrationCandidates.map((moment) => moment.title),
    recentlyClosedTitles: state.recentlyClosedStories.map((thread) => thread.title),
    dormantArcTitles: state.dormantArcs.map((arc) => arc.current.title),
  };
}
